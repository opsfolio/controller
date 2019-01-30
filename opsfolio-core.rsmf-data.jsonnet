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
    opsfolio_certificates : [
	{ certificate_name: 'test', certificate_category: 'public', certificate_type : 'letsencrypt', certificate_authority: 'letsencrypt', validity : '3 months', expiration_date : '03-03-2019', domain_name : 'test.com', key_size : 2048, path: '/etc/letsencrypt/cert/public.pem' }
   ],
    opsfolio_blog : [
	{ title : 'blog_title', body: 'some_data', comments: 'notes on data', tags :'#test,#blog' }
  ],
}
