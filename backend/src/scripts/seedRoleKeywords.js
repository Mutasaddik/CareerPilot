// Curated, industry-standard keyword packs for common roles.
// Bridge layer until Phase 6 provides real scraped market-demand data.
import 'dotenv/config';
import pool, { query } from '../models/db.js';

const PACKS = [
  ['merchandiser',
    ['merchandiser','semi-merchandiser','merchandising executive','apparel merchandiser','garments merchandiser','trainee merchandiser'],
    ['product planning','inventory management','vendor management','cost analysis','product sourcing','supply chain','purchase order','price negotiation','forecasting','production planning','retail operations','market analysis','quality control','buyer communication','order follow-up','sample development','tna management','costing'],
    ['microsoft excel','erp software','plm software','microsoft powerpoint','email communication']],
  ['qa engineer',
    ['qa engineer','software tester','test engineer','sqa engineer','quality assurance engineer','sdet','automation engineer','software quality engineer'],
    ['manual testing','automation testing','test cases','test planning','regression testing','smoke testing','api testing','functional testing','integration testing','performance testing','defect tracking','bug reporting','sdlc','stlc','agile','scrum'],
    ['selenium','playwright','postman','jmeter','jira','testng','cypress','rest assured','jenkins','git','sql']],
  ['software engineer',
    ['software engineer','software developer','programmer','application developer'],
    ['data structures','algorithms','object oriented programming','rest api','microservices','database design','version control','code review','unit testing','agile','ci/cd','debugging','system design'],
    ['java','python','javascript','git','docker','sql','postgresql','spring boot','react','aws']],
  ['frontend developer',
    ['frontend developer','front-end developer','front end developer','ui developer','react developer'],
    ['responsive design','component architecture','state management','rest api integration','cross-browser compatibility','web performance','accessibility','ui/ux collaboration'],
    ['react','javascript','typescript','html','css','tailwind css','redux','next.js','git','figma']],
  ['backend developer',
    ['backend developer','back-end developer','back end developer','node developer','api developer'],
    ['rest api','database design','authentication','caching','message queues','microservices','api security','performance optimization','unit testing'],
    ['node.js','express','postgresql','mongodb','redis','docker','git','aws','sql','nginx']],
  ['full stack developer',
    ['full stack developer','fullstack developer','full-stack developer','mern developer'],
    ['rest api','responsive design','database design','authentication','state management','deployment','agile','version control'],
    ['react','node.js','javascript','typescript','mongodb','postgresql','docker','git','aws','express']],
  ['business analyst',
    ['business analyst','ba','business systems analyst','it business analyst'],
    ['requirements gathering','business requirements document','functional requirements','gap analysis','stakeholder management','process improvement','business process mapping','user stories','use cases','workflow analysis','uat','agile','scrum','root cause analysis'],
    ['jira','confluence','microsoft visio','lucidchart','sql','microsoft excel','power bi']],
  ['marketing specialist',
    ['marketing specialist','digital marketer','digital marketing executive','marketing executive','brand executive','marketing officer'],
    ['digital marketing','content marketing','seo','sem','ppc','social media marketing','campaign management','brand management','email marketing','lead generation','marketing analytics','conversion optimization','market research','consumer behavior'],
    ['google analytics','google ads','meta ads manager','hubspot','semrush','mailchimp','canva','microsoft excel']],
  ['sales executive',
    ['sales executive','sales specialist','sales officer','business development executive','bd executive','sales representative'],
    ['sales strategy','lead generation','client acquisition','business development','account management','negotiation','prospecting','pipeline management','revenue growth','customer retention','cross selling','upselling','sales forecasting','crm'],
    ['salesforce','hubspot crm','zoho crm','microsoft excel']],
  ['event coordinator',
    ['event coordinator','event manager','event executive','event planner','event coordination'],
    ['event planning','vendor coordination','budget management','logistics coordination','sponsorship management','on-site management','promotional campaigns','stakeholder communication','timeline management','brand activation','public relations'],
    ['microsoft excel','microsoft powerpoint','canva','google workspace','social media platforms']],
  ['management trainee',
    ['management trainee','mto','management trainee officer','graduate trainee'],
    ['leadership','team collaboration','business operations','strategic planning','problem solving','data analysis','project coordination','process improvement','reporting','stakeholder coordination','decision making'],
    ['microsoft excel','microsoft powerpoint','power bi','google workspace']],
  ['data analyst',
    ['data analyst','business intelligence analyst','bi analyst','data analytics executive'],
    ['data analysis','data visualization','statistical analysis','reporting','dashboards','data cleaning','kpi tracking','trend analysis','forecasting','etl'],
    ['sql','microsoft excel','power bi','tableau','python','pandas','google analytics']],
  ['hr executive',
    ['hr executive','hr officer','human resources executive','hr generalist','talent acquisition executive'],
    ['recruitment','talent acquisition','onboarding','employee relations','performance management','hr policies','payroll','training and development','hris','compliance','employee engagement'],
    ['microsoft excel','hris software','linkedin recruiter','google workspace']],
  ['accountant',
    ['accountant','accounts executive','junior accountant','accounts officer','finance executive'],
    ['financial reporting','accounts payable','accounts receivable','bank reconciliation','general ledger','tax compliance','vat','budgeting','financial analysis','audit support','bookkeeping'],
    ['tally','quickbooks','microsoft excel','erp software','sap']],
  ['customer service',
    ['customer service representative','customer support executive','customer care executive','call center agent','support specialist'],
    ['customer support','complaint resolution','ticket management','communication skills','customer satisfaction','crm','active listening','escalation handling','product knowledge'],
    ['zendesk','freshdesk','crm software','microsoft excel']],
  ['graphic designer',
    ['graphic designer','visual designer','creative designer','ui designer'],
    ['visual design','branding','typography','layout design','social media creatives','print design','design systems','creative direction'],
    ['adobe photoshop','adobe illustrator','figma','canva','adobe indesign','after effects']],
  ['content writer',
    ['content writer','copywriter','content creator','content executive'],
    ['content writing','copywriting','seo writing','blog writing','editing','proofreading','content strategy','research','storytelling','social media content'],
    ['google docs','wordpress','grammarly','semrush','canva']],
  ['project manager',
    ['project manager','project coordinator','program manager','it project manager'],
    ['project planning','scope management','risk management','stakeholder management','budget management','agile','scrum','resource allocation','timeline management','status reporting'],
    ['jira','microsoft project','asana','trello','confluence','microsoft excel']],
  ['devops engineer',
    ['devops engineer','site reliability engineer','sre','cloud engineer','infrastructure engineer'],
    ['ci/cd','infrastructure as code','containerization','monitoring','automation','cloud architecture','deployment pipelines','incident management'],
    ['docker','kubernetes','jenkins','aws','terraform','linux','git','ansible','prometheus']],
];

const run = async () => {
  let n = 0;
  for (const [role, syn, kw, tools] of PACKS) {
    const r = await query(
      `INSERT INTO taxonomy_role_keywords (role_name, title_synonyms, keywords, tools)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (role_name) DO UPDATE SET title_synonyms = $2, keywords = $3, tools = $4`,
      [role, syn, kw, tools]
    );
    n += r.rowCount;
  }
  console.log(`✅ ${n} curated role keyword packs seeded`);
  await pool.end();
};
run().catch((e) => { console.error('❌', e.message); process.exit(1); });
