# encoding: utf-8
module CartoDB
  module Importer2
    class FDWLoader
      def self.supported?(extension)
        extension =~ /fdw/
      end

      def initialize(job)
        self.job            = job
        self.options        = {}
      end

      def run(post_import_handler_instance=nil)
        @post_import_handler = post_import_handler_instance

        job.log "IMPORTER DEBUG Using database connection with #{job.concealed_pg_options}"

        # Import as foreign table

        # hostname = Cartodb.config[:common_data][:remote_db_host]
        # port = Cartodb.config[:common_data][:remote_db_port]
        # user_id = Cartodb.config[:common_data][:remote_user_id]
        hostname = '127.0.0.1'
        port = 5432
        user_id = '7ee21ce3-48d3-46d6-974b-b889b33496a9'

        # Ensure the conf exists by setting it for every job
        # TODO: Only set conf if it doesn't exist or has changed
        # TODO: Test what happens if we have existing remote tables set and
        # we change the underlying config (e.g. a port or hostname changes)
        job.log "IMPORTER DEBUG Running CDB_Conf_SetConf on #{user_id}@#{hostname}:#{port}"
        query = %Q{
          SELECT * FROM CDB_Conf_SetConf('fdws', '
            {
                "public": {
                    "server": {
                        "extensions": "postgis",
                        "dbname": "cartodb_dev_user_#{user_id}_db",
                        "host": "#{hostname}",
                        "port": #{port}
                    },
                    "users": {
                        "public": {
                            "user": "publicuser",
                            "password": "public"
                        }
                    }
                }
            }
          ')
        }
        job.log "IMPORTER DEBUG Running #{query}"
        #job.db.run(query)

        job.log "IMPORTER DEBUG Running CDB_Add_Remote_Table on #{user_id}@#{hostname}:#{port}"
        job.db.run(%Q{
          SELECT * FROM CDB_Add_Remote_Table('public', '#{job.table_name}')
        })

        self
      # rescue => exception
      #   begin
      #     clean_temporary_tables
      #   ensure
      #     raise exception
      #   end
      end

      # def valid_table_names
      #   [job.table_name]
      # end

      attr_accessor   :options

      private

      attr_accessor   :job
    end
  end
end
