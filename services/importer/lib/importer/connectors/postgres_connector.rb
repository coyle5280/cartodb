# encoding: utf-8

module CartoDB
  module Importer2
    class PostgresConnector < BaseConnector
      # Requirements:
      #   * postgres_fdw extension must be installed in the user database

      # Temptative terminology
      # * connector channel (ODBC, ...)
      # * provider          (MySQL, ...)     [driver]
      # * connection        (database/query) [specific data source]

      def channel_name
        'postgres_fdw'
      end

      private

      def accepted_parameters
        %w(driver channel host port database table username password)
      end

      def server_options
        %w(host port database)
      end

      def foreign_table_name
        v = @params['table']
        print "IMPORTER: foreign_table_name #{v}\n"
        v
      end

      def create_server_command
        v = %{
          CREATE SERVER #{server_name}
            FOREIGN DATA WRAPPER #{@params['channel']}
            OPTIONS (
              host '#{server_params['host']}',
              dbname '#{server_params['database']}',
              port '#{server_params['port']}'
            );
        }
        print "IMPORTER: create_server_command #{v}\n"
        v
      end

      def create_user_mapping_command
        v = %{
          CREATE USER MAPPING FOR "#{@user.database_username}" SERVER #{server_name}
            OPTIONS ( user '#{@params['username']}', password '#{@params['password']}');
          CREATE USER MAPPING FOR "postgres" SERVER #{server_name}
            OPTIONS ( user '#{@params['username']}', password '#{@params['password']}')
        }
        print "IMPORTER: create_user_mapping_command #{v}\n"
        v
      end

      def create_foreign_table_command
        v = %{
          IMPORT FOREIGN SCHEMA #{@schema} LIMIT TO (#{foreign_table_name})
            FROM SERVER #{server_name} INTO #{@schema}
        }
        print "IMPORTER: create_foreign_table_command #{v}\n"
        v
      end

      def run_post_create
        print "IMPORTER: NOOP run_post_create\n"
      end

      def run_post_create_ensure
        print "IMPORTER: NOOP run_post_create_ensure\n"
      end
    end
  end
end
