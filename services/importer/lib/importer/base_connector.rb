# encoding: utf-8

require_relative './exceptions'

module CartoDB
  module Importer2
    class BaseConnector
      # Requirements:
      #   * odbc_fdw extension must be installed in the user database

      # Temptative terminology
      # * connector channel (ODBC, ...)
      # * provider          (MySQL, ...)     [driver]
      # * connection        (database/query) [specific data source]

      class ConnectorError < StandardError
        attr_reader :channel_name, :user_name

        def initialize(message = 'General error', channel = nil, user = nil)
          @channel_name  = channel
          @user_name     = user && user.username
          message = message.to_s
          message << " Channel: #{@channel_name}" if @channel_name
          message << " User: #{@user_name}" if @user_name
          super(message)
        end
      end

      class InvalidChannelError < ConnectorError
        def initialize(channel, user = nil)
          super "Invalid channel", channel, user
        end
      end

      class InvalidParametersError < ConnectorError
      end

      attr_reader :results, :log, :job
      attr_accessor :channel, :stats

      # @param connector_source string
      #     of the form #{channel}:key1=value1;key2=value2...keyn=valuen
      def initialize(connector_source, options = {})
        @pg_options = options[:pg]
        @log        = options[:log] || new_logger
        @job        = options[:job] || new_job(@log, @pg_options)
        @user       = options[:user]

        @id = @job.id
        @unique_suffix = @id.delete('-')
        @conn_str = connector_source
        extract_params
        print "IMPORTER: raw params #{@params}\n"
        validate_params!
        print "IMPORTER: validated params #{@params}\n"
        @schema = @user.database_schema
        @table_name = @params['table'] || @job.table_name
        print "IMPORTER: schemas #{@schema}, #{@job.schema}\n"
        print "IMPORTER: table_name #{@params['table_name']}, #{@job.table_name}\n"
        @results = []
        @tracker = nil
        @stats = {}
      end

      def channel_name
        'odbc_fdw'
      end

      def run(tracker = nil)
        @tracker = tracker
        @job.log "Connector #{@conn_str}"
        # TODO: deal with schemas, org users, etc.,
        # TODO: logging with CartoDB::Logger
        @job.log "Running pre-create tasks"
        run_pre_create
        @job.log "Creating Server"
        print "IMPORTER: creating server\n"
        run_create_server
        @job.log "Creating user mapping"
        print "IMPORTER: creating user mapping\n"
        run_create_user_mapping
        @job.log "Creating Foreign Table"
        print "IMPORTER: creating foreign table\n"
        run_create_foreign_table
        @job.log "Running post create"
        print "IMPORTER: running post create\n"
        run_post_create
      rescue => error
        @job.log "Connector Error #{error}"
        print "IMPORTER: error #{error}"
        @results.push result_for(@schema, @table_name, error)
      else
        @job.log "Connector created table #{@table_name}"
        @job.log "job schema: #{@schema}"
        print "IMPORTER: created table #{@table_name}"
        @results.push result_for(@schema, @table_name)
      ensure
        print "IMPORTER: connector cleanup"
        run_post_create_ensure
      end

      def success?
        results.count(&:success?) > 0
      end

      def remote_data_updated?
        # TODO: can we detect if query results have changed?
        true
      end

      def tracker
        @tracker || lambda { |state| state }
      end

      def visualizations
        []
      end

      def warnings
        []
      end

      private

      def accepted_parameters
        %w(dsn driver channel host port database table username password sql_query sql_count)
      end

      def server_options
        %w(dsn driver channel host port database)
      end

      def server_params
        @params.slice(*server_options)
      end

      def table_params
        @params.except(*server_options)
      end

      PARAM_SEP_TOKENS = {
        '.eq.' => '=',
        '.sc.' => ';'
      }.freeze

      # Parse connection string in @conn_str and extract @params and @columns
      def extract_params
        # Convert into hash form: "p=v;..." -> { 'p' => v, ...}
        @params = Hash[
          @conn_str.split(';').map do |p|
            param, value = p.split('=').map(&:strip)
            [param.downcase, value]
          end
        ]

        # Decode special tokens for the separator chars used.
        # (this is to allow its use in parameters such as sql_query)
        @params.each do |key, value|
          PARAM_SEP_TOKENS.each do |token, symbol|
            value = value.gsub(token, symbol)
          end
          @params[key] = value
        end

        # Extract columns of the result table from the parameters
        # Column definitions are expected in SQL syntax, e.g.
        #     columns=id int, name text
        @columns = @params.delete 'columns'
        @columns = @columns.split(',').map(&:strip) if @columns
      end

      def validate_params!
        errors = []
        if @params['dsn'].blank? &&
           (@params['driver'].blank? || @params['database'].blank? || @params['table'].blank?)
          errors << "Missing required parameters"
        end
        if @params['channel'].blank? || @params['channel'].casecmp(channel_name) != 0
          print "IMPORTER: channel name #{channel_name}\n"
          print "IMPORTER: compare #{@params['channel'].casecmp(channel_name)}\n"
          raise InvalidChannelError.new(@params['channel'], @user)
        end
        #errors << "Missing columns definition" unless @columns.present?
        invalid_params = @params.keys - accepted_parameters
        errors << "Invalid parameters: #{invalid_params * ', '}" if invalid_params.present?
        raise InvalidParametersError.new(errors * "\n") if errors.present?
      end

      def connector_name
        @params['dsn'] || @params['driver']
      end

      def server_name
        v = "connector_#{connector_name}_#{@unique_suffix}"
        print "IMPORTER: server_name #{v}\n"
        v
      end

      def foreign_table_name
        v = "#{server_name}_#{@params['table']}"
        print "IMPORTER: foreign_table_name #{v}\n"
        v
      end

      def run_create_server
        execute_as_superuser create_server_command
      end

      def create_server_command
        options = server_params.map { |k, v| "#{k} '#{v}'" } * ",\n"
        v = %{
          CREATE SERVER #{server_name}
            FOREIGN DATA WRAPPER #{@params['channel']}
            OPTIONS (#{options});
        }
        print "IMPORTER: create_server_command #{v}\n"
        v
      end

      def run_create_user_mapping
        execute_as_superuser create_user_mapping_command
      end

      def create_user_mapping_command
        v = %{
          CREATE USER MAPPING FOR "#{@user.database_username}" SERVER #{server_name};
        }
        print "IMPORTER: create_user_mapping_command #{v}\n"
        v
      end

      def run_create_foreign_table
        execute_as_superuser create_foreign_table_command
      end

      def create_foreign_table_command
        options = table_params.map { |k, v| "#{k} '#{v}'" } * ",\n"
        print "IMPORTER: foreign table options: #{options}\n"
        v = %{
          CREATE FOREIGN TABLE #{foreign_table_name} (#{@columns * ','})
            SERVER #{server_name}
            OPTIONS (#{options});
          GRANT SELECT ON #{foreign_table_name} TO "#{@user.database_username}";
        }
        print "IMPORTER: create_foreign_table_command #{v}\n"
        v
      end

      def run_pre_create
        # NOOP by default
      end

      def run_post_create
        qualified_table_name = %{"#{@schema}"."#{@table_name}"}
        execute "CREATE TABLE #{qualified_table_name} AS SELECT * FROM #{foreign_table_name};"
      end

      def drop_server_command
        print "IMPORTER: dropping server\n"
        "DROP SERVER IF EXISTS #{server_name} CASCADE;"
      end

      def drop_foreign_table_command
        print "IMPORTER: dropping foreign table\n"
        "DROP FOREIGN TABLE IF EXISTS #{foreign_table_name} CASCADE;"
      end

      def run_post_create_ensure
        @log.append_and_store "Connector cleanup"
        execute_as_superuser drop_foreign_table_command
        execute_as_superuser drop_server_command
        @log.append_and_store "Connector cleaned-up"
      end

      def execute_as_superuser(command)
        @user.in_database(as: :superuser).execute command
      end

      def execute(command)
        @user.in_database.execute command
      end

      def result_for(schema, table_name, error = nil)
        print "IMPORTER: Pushing result - #{schema}, #{table_name}, #{error}\n"
        @job.success_status = !error
        @job.logger.store
        Result.new(
          name:           @params['table'],
          schema:         schema,
          tables:         [table_name],
          success:        @job.success_status,
          error_code:     error_for(error),
          log_trace:      @job.logger.to_s,
          support_tables: []
        )
      end

      def new_logger
        CartoDB::Log.new(type: CartoDB::Log::TYPE_DATA_IMPORT)
      end

      def new_job(log, pg_options)
        Job.new(logger: log, pg_options: pg_options)
      end

      UNKNOWN_ERROR_CODE = 99999

      def error_for(exception)
        exception && ERRORS_MAP.fetch(exception.class, UNKNOWN_ERROR_CODE)
      end
    end
  end
end
