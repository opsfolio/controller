{
    opsfolio_raci_matrix : [
        { asset: 'test 1',  responsible: 'Shahid Shah', accountable : 'John Smith' }
    ],
    opsfolio_asset_risk : [
        { asset_risk_type_id : 1, threat_event: 'something' }
    ],
    opsfolio_vulnerability : [
        { vulnerability_id : 1, short_name: 'CVE-1345', source : 'null', affected_software : 'kernel', reference : 'null', status : 'low', patch_availability : 'available', severity : 'low', solutions : 'security Patching', tags: 'null', description : 'some_data'  }
    ],
    opsfolio_scheduled_tasks : [
        {   description: 'some_task', task_date : '30-01-2019:10:10:10', reminder_date : '29-01-2019:10:10:10', assigned_to : 'someone@mail.com', reminder_to : 'someone@mail.com'  }
    ],
}
