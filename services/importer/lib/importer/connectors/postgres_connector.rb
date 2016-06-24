# encoding: utf-8

require_relative './exceptions'

module CartoDB
  module Importer2
    class PostgresConnector < BaseConnector
      # Requirements:
      #   * postgres_fdw extension must be installed in the user database

      # Temptative terminology
      # * connector channel (ODBC, ...)
      # * provider          (MySQL, ...)     [driver]
      # * connection        (database/query) [specific data source]

      CHANNEL_NAME = 'postgres_fdw'

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

      ACCEPTED_PARAMETERS = %w(host port database table username password).freeze
      SERVER_OPTIONS = %w(host port database).freeze

      def connector_name
        'postgres'
      end

      def foreign_table_name
        v = @params['table']
        print "IMPORTER: foreign_table_name #{v}"
        v
      end

      def create_foreign_table_command
        v = %{
          IMPORT FOREIGN SCHEMA IF NOT EXISTS #{@schema} LIMIT TO (#{foreign_table_name})
            FROM SERVER #{server_name} INTO #{@schema}
        }
        print "IMPORTER: create_foreign_table_command #{v}"
        v
      end

      def drop_server_command
        "DROP SERVER IF EXISTS #{server_name} CASCADE;"
      end

      def drop_foreign_table_command
        "DROP FOREIGN TABLE IF EXISTS #{foreign_table_name} CASCADE;"
      end

      def execute_as_superuser(command)
        @user.in_database(as: :superuser).execute command
      end

      def execute(command)
        @user.in_database.execute command
      end

      def result_for(schema, table_name, error = nil)
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
