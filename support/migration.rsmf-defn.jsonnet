local context = import "context.rsmf-facts.json";
local rsmf = import "rsmf.libsonnet";
local columnTypes = rsmf.columnTypes;
local tableTypes = rsmf.tableTypes;

local opsfolioDBHome = context.migrationDefnHome;
local opsfolioCoreDBName = "opsfolio-core";
local osQueryConfigSuffix = "-osquery-config.json.conf";
local osQueryHome ="/etc/osquery";
local opsfolioDirectory = "/opt/opsfolio";

local core = {
    databaseName : opsfolioCoreDBName,
    tables : [
        tableTypes.enum('opsfolio_asset_risk_type', [
            { code: 'one', value : 'One', abbrev: 'one' },
        ]),

        tableTypes.typical('opsfolio_raci_matrix', [
            columnTypes.identity(),
            columnTypes.text('asset', required=true),
            columnTypes.text('responsible'),
            columnTypes.text('accountable'),
            columnTypes.text('consulted'),
            columnTypes.text('informed'),
        ]),

        tableTypes.typical('opsfolio_asset_risk', [
            columnTypes.identity(),
            columnTypes.enum('opsfolio_asset_risk_type', name = 'asset_risk_type_id', required=true),
            columnTypes.text('threat_event'),
            columnTypes.text('relevance'),
            columnTypes.text('likelihood'),
            columnTypes.text('impact'),
            columnTypes.text('risk')
        ]),
		
	tableTypes.typical('opsfolio_vulnerability', [
            columnTypes.identity(),
            columnTypes.enum('opsfolio_vulnerability', name = 'vulnerability_id', required=true),
            columnTypes.text('short_name'),
            columnTypes.text('source'),
            columnTypes.text('affected_software'),
            columnTypes.text('reference'),
            columnTypes.text('status'),
	    columnTypes.text('patch_availability'),
            columnTypes.text('severity'),
            columnTypes.text('solutions'),
            columnTypes.text('tags'),
            columnTypes.text('description'),
        ]),
		
	tableTypes.typical('opsfolio_billing', [
            columnTypes.identity(),
            columnTypes.enum('billing_type', name = 'billing_id', required=true),
            columnTypes.text('purpose'),
            columnTypes.text('bill_rate'),
            columnTypes.text('period'),
            columnTypes.datetime('effective_from_date'),
            columnTypes.text('effective_to_date'),
	    columnTypes.integer ('prorate'),
        ]),
		
	tableTypes.typical('opsfolio_scheduled_tasks', [
            columnTypes.identity(),
            columnTypes.text('description'),
            columnTypes.datetime('task_date'),
            columnTypes.datetime('reminder_date'),
            columnTypes.text('assigned_to'),
            columnTypes.text('reminder_to'),		
        ]),
		
	tableTypes.typical('opsfolio_timesheet', [
            columnTypes.identity(),
            columnTypes.enum('opsfolio_timesheet', name = 'opsfolio_timesheet_id', required=true),
            columnTypes.integer('time_hour'),
            columnTypes.text('timesheet_summary'),
            columnTypes.text('start_time'),
            columnTypes.text('end_time'),		
        ]),
	
	tableTypes.typical('opsfolio_certificates', [
            columnTypes.identity(),
            columnTypes.text('certificate_name'),
            columnTypes.text('short_name'),
            columnTypes.text('certificate_category'),
            columnTypes.text('certificate_type'),
            columnTypes.text('certificate_authority'),
            columnTypes.text('validity'),
            columnTypes.datetime('expiration_date'),
	    columnTypes.text('domain_name'),
       	    columnTypes.integer('key_size'),
            columnTypes.text('path'),		
        ]),
	
	tableTypes.typical('opsfolio_blog', [
            columnTypes.identity(),
            columnTypes.text('title'),
            columnTypes.text('body'),
            columnTypes.text('comments'),
	    columnTypes.text('tags')
        ]),	
	
	tableTypes.typical('opsfolio_medical_devices', [
            columnTypes.identity(),
            columnTypes.text('device_name '),
            columnTypes.text('short_name'),
            columnTypes.text('unique_device_number'),
            columnTypes.text('device_category'),
	    columnTypes.text('device_secret_key'),
            columnTypes.text('vendor_name'),
            columnTypes.text('manufacturer'),
            columnTypes.datetime('expiry_date'),
	    columnTypes.datetime('implant_date'),
	    columnTypes.datetime('deactivation_date'),
	    columnTypes.text('purpose'),
	    columnTypes.integer('description'),
        
        ]),
	
        tableTypes.typical('opsfolio_devices', [
            columnTypes.identity(),
            columnTypes.text('device_name'),
            columnTypes.text('short_name'),
            columnTypes.text('barcode'),
            columnTypes.text('model'),
            columnTypes.text('serial_number'),
            columnTypes.text('firmware'),
            columnTypes.text('data_center'),
            columnTypes.text('location'),
            columnTypes.text('purpose'),
            columnTypes.integer('description'),

        ]),

        tableTypes.typical('opsfolio_threat_sources', [
            columnTypes.identity(),
            columnTypes.text('threat_source'),
            columnTypes.text('identifier'),
            columnTypes.text('threat_source_type'),
            columnTypes.text('source_of_information'),
            columnTypes.text('capability'),
            columnTypes.text('intent'),
            columnTypes.text('targeting'),
            columnTypes.integer('description'),

        ]), 

        tableTypes.typical('opsfolio_threat_events', [
            columnTypes.identity(),
            columnTypes.text('threat_event'),
            columnTypes.text('identifier'),
            columnTypes.integer('threat_event_type'),
            columnTypes.text('event_classification'),
            columnTypes.text('source_of_information'),
            columnTypes.integer('description'),

        ]),




			
    ],
    data : import "opsfolio-core.rsmf-data.jsonnet"
};

{
    [opsfolioCoreDBName + ".sql"] : 
        "PRAGMA foreign_keys = ON;\n\n" +
        rsmf.createTablesSQL(core) +
        rsmf.createDataSQL(core),

    [opsfolioCoreDBName + osQueryConfigSuffix] : rsmf.osQueryConfigATC(core, opsfolioDBHome + "/%(databaseName)s.db"),

    [context.makeFile.customTargetsIncludeFile] : |||
        # Delete the %(opsfolioCoreDBName)s SQLite database
        clean-%(opsfolioCoreDBName)s-db:
        	$(call logInfo,Deleted $(YELLOW)%(opsfolioDBHome)s/%(opsfolioCoreDBName)s.db$(RESET) SQLite database)
        	rm -f "%(opsfolioDBHome)s/%(opsfolioCoreDBName)s.db"

        # Create the %(opsfolioCoreDBName)s SQLite database
        create-%(opsfolioCoreDBName)s-db: clean-%(opsfolioCoreDBName)s-db
        	$(call logInfo,Created SQLite database $(YELLOW)%(opsfolioDBHome)s/%(opsfolioCoreDBName)s.db$(RESET))
        	cat %(opsfolioCoreDBName)s.sql | sqlite3 "%(opsfolioDBHome)s/%(opsfolioCoreDBName)s.db"

        # Remove the %(opsfolioCoreDBName)s osQuery ATC configuration
        clean-%(opsfolioCoreDBName)s-osquery-ATC-config:
        	$(call logInfo,Removed $(YELLOW)%(osQueryConfigDPath)s/%(opsfolioCoreDBName)s%(osQueryConfigSuffix)s$(RESET) osQuery ATC configuration)
        	sudo rm -f "%(osQueryConfigDPath)s/%(opsfolioCoreDBName)s%(osQueryConfigSuffix)s"

        # Create the %(opsfolioCoreDBName)s osQuery ATC configuration
        create-%(opsfolioCoreDBName)s-osquery-ATC-config: clean-%(opsfolioCoreDBName)s-osquery-ATC-config
        	$(call logInfo,Created $(YELLOW)%(osQueryConfigDPath)s/%(opsfolioCoreDBName)s%(osQueryConfigSuffix)s$(RESET) osQuery ATC configuration)
        	sudo ln -sf "%(migrationDefnHome)s/%(opsfolioCoreDBName)s%(osQueryConfigSuffix)s" "%(osQueryConfigDPath)s/%(opsfolioCoreDBName)s%(osQueryConfigSuffix)s"
        	$(call logInfo,Restarted osQuery)
        	sudo /etc/init.d/osqueryd restart

        ## Create the Opsfolio database(s)
        create-db: create-%(opsfolioCoreDBName)s-db

        ## Setup osQuery with Opsfolio ATCs
        create-osQuery-ATC: create-%(opsfolioCoreDBName)s-osquery-ATC-config

        ## Create the Opsfolio database and create osQuery ATC configuration
        opsfolio: create-db create-osQuery-ATC
    ||| % { 
        opsfolioDirectory : opsfolioDirectory, 
        osQueryHome : osQueryHome,
        osQueryConfigSuffix : osQueryConfigSuffix,
        opsfolioDBHome : opsfolioDBHome, 
        opsfolioCoreDBName : opsfolioCoreDBName,
        osQueryConfigDPath : context.osQuery.configDPath,
        migrationDefnHome : context.migrationDefnHome
    },
}
