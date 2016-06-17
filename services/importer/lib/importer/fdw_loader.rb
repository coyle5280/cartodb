# encoding: utf-8
module CartoDB
  module Importer2
    class FdwLoader
      def self.supported?(extension)
        extension =~ /fdw/
      end

      def initialize(job, source_file)
        self.job            = job
        self.source_file    = source_file
        self.options        = {}
      end

      def run(post_import_handler_instance=nil)
        @post_import_handler = post_import_handler_instance

        job.log "Using database connection with #{job.concealed_pg_options}"

        # Import as foreign table

        hostname = Cartodb.config[:common_data][:remote_db_host]
        port = Cartodb.config[:common_data][:remote_db_port]
        user_id = Cartodb.config[:common_data][:remote_user_id]

        # Ensure the conf exists by setting it for every job
        # TODO: Only set conf if it doesn't exist or has changed
        # TODO: Test what happens if we have existing remote tables set and
        # we change the underlying config (e.g. a port or hostname changes)
        job.db.run(%Q{
          SELECT * FROM CDB_Conf_SetConf('fdws', '
            {
                \"public\": {
                    \"server\": {
                        \"extensions\": \"postgis\",
                        \"dbname\": \"cartodb_dev_user_#{user_id}\",
                        \"host\": \"#{remote_db_host}\",
                        \"port\": #{remote_db_port}
                    },
                    \"users\": {
                        \"public\": {
                            \"user\": \"publicuser\",
                            \"password\": \"public\"
                        }
                    }
                }
            }
          ')
        })
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

      attr_accessor   :job, :source_file
    end
  end
end
