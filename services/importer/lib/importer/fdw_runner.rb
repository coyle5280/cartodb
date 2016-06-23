# encoding: utf-8
require_relative './fdw_loader'
require_relative './column'
require_relative './exceptions'
require_relative './result'

require_relative '../../../../lib/cartodb/stats/importer'

module CartoDB
  module Importer2
    class FDWRunner

      UNKNOWN_ERROR_CODE      = 99999

      # @param options Hash
      # {
      #   :pg Hash { ... }
      #   :log CartoDB::Log|nil
      #   :job CartoDB::Importer2::Job|nil
      #   :user ::User|nil
      #   :importer_config ::Hash|nil
      # }
      # @throws KeyError
      def initialize(options={})
        @pg_options          = options.fetch(:pg)
        @log                 = options.fetch(:log, nil) || new_logger
        @job                 = options.fetch(:job, nil) || new_job(log, pg_options)
        @loader = FDWLoader.new(@job)

        @user = options.fetch(:user, nil)
        @importer_config = options.fetch(:importer_config, nil)
        @importer_stats = CartoDB::Stats::Importer.instance
        @loader_options      = {}
        @results             = []
        @stats               = []
        @warnings = {}
      end

      def loader_options=(value)
        @loader_options = value
      end

      def new_logger
        CartoDB::Log.new(type: CartoDB::Log::TYPE_DATA_IMPORT)
      end

      def include_additional_errors_mapping(additional_errors)
        @additional_errors = additional_errors
      end

      def errors_to_code_mapping
        @additional_errors.nil? ? ERRORS_MAP : ERRORS_MAP.merge(@additional_errors)
      end

      def run(&tracker_block)
        @importer_stats.timing('run') do
          run_import(&tracker_block)
        end
      end

      def run_import(&tracker_block)
        @tracker = tracker_block
        tracker.call('uploading')

        @loader.run

      rescue => exception
        # Delete job temporary table from cdb_importer schema
        delete_job_table

        log.append "Errored importing data:"
        log.append "#{exception.class.to_s}: #{exception.to_s}", truncate=false
        log.append '----------------------------------------------------'
        log.append exception.backtrace, truncate=false
        log.append '----------------------------------------------------'
        @results.push(Result.new(error_code: error_for(exception.class), log_trace: report))
      end

      def report
        "Log Report: #{log.to_s}"
      end

      def loader_for(source_file)
        loaders = LOADERS
        loaders.find(DEFAULT_LOADER) { |loader_klass|
          loader_klass.supported?(source_file.extension)
        }
      end

      def remote_data_updated?
        false
      end

      def last_modified
        DateTime.current
      end

      def etag
        @downloader.etag
      end

      def checksum
        @downloader.checksum
      end

      # If not specified, fake
      def tracker
        @tracker || lambda { |state| state }
      end

      def success?
        results.count(&:success?) > 0
      end

      attr_reader :results, :log, :job, :loader, :warnings
      attr_accessor :stats

      private

      attr_reader :pg_options, :job
      attr_writer :results
      attr_accessor :tracker

      def result_for(job, source_file, table_names, support_table_names=[], exception_klass=nil)
        # TODO: Reimplement
        job.logger.store
        Result.new(
          name:           source_file.name,
          schema:         source_file.target_schema,
          extension:      source_file.extension,
          etag:           source_file.etag,
          checksum:       source_file.checksum,
          last_modified:  source_file.last_modified,
          tables:         table_names,
          success:        job.success_status,
          error_code:     error_for(exception_klass),
          log_trace:      job.logger.to_s,
          support_tables: support_table_names
        )
      end

      def error_for(exception_klass=nil)
        return nil unless exception_klass
        errors_to_code_mapping.fetch(exception_klass, UNKNOWN_ERROR_CODE)
      end

      def new_job(log, pg_options)
        Job.new({ logger: log, pg_options: pg_options })
      end

      def add_warning(warning)
        @warnings.merge!(warning)
      end

      def delete_job_table
        # TODO: Reimplement
        print "IMPORTER: FDWRunner.delete_job_table not implemented\n"
      end
    end
  end
end