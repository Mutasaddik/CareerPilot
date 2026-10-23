// ════════════════════════════════════════════════════════════════
// Certification catalog — well-known certifications per field.
//
// Every entry is a real certification from its real issuer. `url` is the
// issuer's official page; `urlVerified` records whether we could load it
// automatically (some issuers block automated checks — the UI says so).
// Links were checked on 2026-10-23.
//
// `match` finds the certification in a job ad or CV. Ambiguous acronyms
// set `needsContext`: the ad must also talk about certification/qualification
// nearby, so e.g. a marketing ad's "CMA" or a skill list's "Google Ads"
// doesn't count as a certification request.
//
// `fields` says which professions it belongs to: occupation keys
// ("cp:qa engineer") or SOC prefixes ("soc:15-12" = computer occupations).
// ════════════════════════════════════════════════════════════════

export const CERTIFICATIONS = [
  // ── Software testing / development / cloud ─────────────────────
  { id: 'istqb-ctfl', name: 'ISTQB Certified Tester Foundation Level (CTFL)', issuer: 'ISTQB',
    url: 'https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/', urlVerified: true,
    proves: 'Internationally recognised knowledge of software testing fundamentals.',
    match: /\bistqb\b|\bctfl\b/i, fields: ['cp:qa engineer', 'soc:15-1253'] },
  { id: 'aws', name: 'AWS Certification (e.g. Solutions Architect, Developer)', issuer: 'Amazon Web Services',
    url: 'https://aws.amazon.com/certification/', urlVerified: true,
    proves: 'Hands-on ability to design, build or run systems on Amazon Web Services.',
    match: /\baws certifi(ed|cation)\b|\baws solutions architect\b/i,
    fields: ['cp:devops engineer', 'cp:backend developer', 'cp:software engineer', 'cp:full stack developer', 'soc:15-1244', 'soc:15-1299'] },
  { id: 'azure', name: 'Microsoft Azure Certification (e.g. AZ-900, AZ-104)', issuer: 'Microsoft',
    url: 'https://learn.microsoft.com/en-us/credentials/', urlVerified: true,
    proves: 'Skills in Microsoft Azure cloud services, from fundamentals to administration.',
    match: /\baz-\d{3}\b|\bazure (fundamentals|administrator|developer associate|solutions architect)\b|\bazure certifi/i,
    fields: ['cp:devops engineer', 'cp:backend developer', 'soc:15-1244', 'soc:15-1299'] },
  { id: 'gcp', name: 'Google Cloud Certification', issuer: 'Google Cloud',
    url: 'https://cloud.google.com/learn/certification', urlVerified: true,
    proves: 'Skills in designing and running workloads on Google Cloud.',
    match: /\bgoogle cloud certifi|\bgcp certifi|\bprofessional cloud (architect|engineer)\b/i,
    fields: ['cp:devops engineer', 'soc:15-1244', 'soc:15-1299'] },
  { id: 'cka', name: 'Certified Kubernetes Administrator (CKA)', issuer: 'The Linux Foundation / CNCF',
    url: 'https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/', urlVerified: true,
    proves: 'Practical skills in installing and operating Kubernetes clusters.',
    match: /\bcka\b|\bcertified kubernetes administrator\b/i, fields: ['cp:devops engineer', 'soc:15-1244'] },
  { id: 'google-da', name: 'Google Data Analytics Professional Certificate', issuer: 'Google',
    url: 'https://grow.google/certificates/data-analytics/', urlVerified: true,
    proves: 'Entry-level data analysis: spreadsheets, SQL, visualisation and R.',
    match: /\bgoogle data analytics (professional )?certificate\b/i, fields: ['cp:data analyst', 'soc:15-2051'] },
  { id: 'pl300', name: 'Microsoft Power BI Data Analyst (PL-300)', issuer: 'Microsoft',
    url: 'https://learn.microsoft.com/en-us/credentials/certifications/data-analyst-associate/', urlVerified: true,
    proves: 'Building reports and data models in Power BI.',
    match: /\bpl-300\b|\bpower bi (certifi|data analyst associate)/i, fields: ['cp:data analyst', 'cp:business analyst', 'soc:15-2051'] },

  // ── Networking / security ──────────────────────────────────────
  { id: 'ccna', name: 'Cisco Certified Network Associate (CCNA)', issuer: 'Cisco',
    url: 'https://www.cisco.com/site/us/en/learn/training-certifications/certifications/enterprise/ccna/index.html', urlVerified: true,
    proves: 'Networking fundamentals: routing, switching, IP services and security basics.',
    match: /\bccna\b/i, fields: ['soc:15-1241', 'soc:15-1244', 'soc:15-1231', 'soc:15-1299', 'cp:devops engineer'] },
  { id: 'ccnp', name: 'Cisco Certified Network Professional (CCNP)', issuer: 'Cisco',
    url: 'https://www.cisco.com/site/us/en/learn/training-certifications/certifications/enterprise/ccnp-enterprise/index.html', urlVerified: true,
    proves: 'Advanced enterprise networking skills.',
    match: /\bccnp\b/i, fields: ['soc:15-1241', 'soc:15-1244', 'soc:15-1299'] },
  { id: 'comptia-a', name: 'CompTIA A+', issuer: 'CompTIA',
    url: 'https://www.comptia.org/certifications/a', urlVerified: true,
    proves: 'IT support fundamentals: hardware, operating systems and troubleshooting.',
    match: /\bcomptia a\+|\ba\+ certifi/i, fields: ['soc:15-1231', 'soc:15-1232'] },
  { id: 'comptia-net', name: 'CompTIA Network+', issuer: 'CompTIA',
    url: 'https://www.comptia.org/certifications/network', urlVerified: true,
    proves: 'Vendor-neutral networking skills.',
    match: /\bnetwork\+/i, fields: ['soc:15-1231', 'soc:15-1241', 'soc:15-1244'] },
  { id: 'comptia-sec', name: 'CompTIA Security+', issuer: 'CompTIA',
    url: 'https://www.comptia.org/certifications/security', urlVerified: true,
    proves: 'Core cybersecurity skills.',
    match: /\bsecurity\+/i, fields: ['soc:15-1212', 'soc:15-1244'] },
  { id: 'ceh', name: 'Certified Ethical Hacker (CEH)', issuer: 'EC-Council',
    url: 'https://www.eccouncil.org/train-certify/certified-ethical-hacker-ceh/', urlVerified: true,
    proves: 'Ethical hacking and penetration-testing skills.',
    match: /\bceh\b|\bcertified ethical hacker\b/i, fields: ['soc:15-1212'] },
  { id: 'cissp', name: 'CISSP', issuer: 'ISC2',
    url: 'https://www.isc2.org/certifications/cissp', urlVerified: true,
    proves: 'Senior-level information security management.',
    match: /\bcissp\b/i, fields: ['soc:15-1212', 'soc:11-3021'] },
  { id: 'cisa', name: 'Certified Information Systems Auditor (CISA)', issuer: 'ISACA',
    url: 'https://www.isaca.org/credentialing/cisa', urlVerified: true,
    proves: 'Auditing, control and assurance of information systems.',
    match: /\bcisa\b/i, needsContext: true, fields: ['soc:15-1212', 'soc:13-2011', 'cp:accountant'] },
  { id: 'cism', name: 'Certified Information Security Manager (CISM)', issuer: 'ISACA',
    url: 'https://www.isaca.org/credentialing/cism', urlVerified: true,
    proves: 'Managing an enterprise information security programme.',
    match: /\bcism\b/i, fields: ['soc:15-1212', 'soc:11-3021'] },

  // ── Project management / agile ─────────────────────────────────
  { id: 'pmp', name: 'Project Management Professional (PMP)', issuer: 'Project Management Institute (PMI)',
    url: 'https://www.pmi.org/certifications/project-management-pmp', urlVerified: false,
    proves: 'Experienced project managers\' ability to lead projects end to end.',
    match: /\bpmp\b/i, fields: ['cp:project manager', 'soc:13-1082', 'soc:11-9021', 'soc:11-3021'] },
  { id: 'capm', name: 'Certified Associate in Project Management (CAPM)', issuer: 'Project Management Institute (PMI)',
    url: 'https://www.pmi.org/certifications/certified-associate-capm', urlVerified: false,
    proves: 'Entry-level project management knowledge.',
    match: /\bcapm\b/i, fields: ['cp:project manager', 'cp:management trainee', 'soc:13-1082'] },
  { id: 'prince2', name: 'PRINCE2 Project Management', issuer: 'PeopleCert / AXELOS',
    url: 'https://www.axelos.com/certifications/propath/prince2-project-management', urlVerified: true,
    proves: 'A structured, widely used project management method.',
    match: /\bprince ?2\b/i, fields: ['cp:project manager', 'soc:13-1082'] },
  { id: 'psm', name: 'Professional Scrum Master I (PSM I)', issuer: 'Scrum.org',
    url: 'https://www.scrum.org/assessments/professional-scrum-master-i-certification', urlVerified: false,
    proves: 'Understanding of Scrum and the Scrum Master role.',
    match: /\bpsm ?i?\b|\bprofessional scrum master\b/i, needsContext: true,
    fields: ['cp:project manager', 'cp:software engineer', 'cp:qa engineer', 'soc:13-1082'] },
  { id: 'csm', name: 'Certified ScrumMaster (CSM)', issuer: 'Scrum Alliance',
    url: 'https://www.scrumalliance.org/get-certified/scrum-master-track/certified-scrummaster', urlVerified: true,
    proves: 'Scrum Master practice and agile team facilitation.',
    match: /\bcertified scrum ?master\b|\bcsm\b/i, needsContext: true, fields: ['cp:project manager', 'soc:13-1082'] },

  // ── Accounting / finance / banking (Bangladesh first) ──────────
  { id: 'icab-ca', name: 'Chartered Accountant (CA) — ICAB', issuer: 'Institute of Chartered Accountants of Bangladesh (ICAB)',
    url: 'https://www.icab.org.bd/', urlVerified: true,
    proves: 'Bangladesh\'s professional accountancy qualification (audit, tax, financial reporting).',
    match: /\bicab\b|\bchartered accountan(t|cy)\b|\bca[- ](cc|qualified|finalist|part[- ]?qualified)\b/i,
    fields: ['cp:accountant', 'soc:13-2011', 'soc:11-3031'] },
  { id: 'icmab-cma', name: 'Cost and Management Accountant (CMA) — ICMAB', issuer: 'Institute of Cost and Management Accountants of Bangladesh (ICMAB)',
    url: 'https://www.icmab.org.bd/', urlVerified: false,
    proves: 'Bangladesh\'s qualification in cost and management accounting.',
    match: /\bicmab\b|\bcma\b/i, needsContext: true, fields: ['cp:accountant', 'soc:13-2011', 'soc:11-3031'] },
  { id: 'acca', name: 'ACCA Qualification', issuer: 'Association of Chartered Certified Accountants (ACCA)',
    url: 'https://www.accaglobal.com/', urlVerified: true,
    proves: 'International accountancy qualification in accounting, audit and finance.',
    match: /\bacca\b/i, fields: ['cp:accountant', 'soc:13-2011', 'soc:11-3031'] },
  { id: 'cima', name: 'CIMA Professional Qualification (CGMA)', issuer: 'CIMA / AICPA & CIMA',
    url: 'https://www.cimaglobal.com/', urlVerified: true,
    proves: 'Management accounting and business finance.',
    match: /\bcima\b|\bcgma\b/i, fields: ['cp:accountant', 'soc:13-2011', 'soc:11-3031'] },
  { id: 'cfa', name: 'Chartered Financial Analyst (CFA)', issuer: 'CFA Institute',
    url: 'https://www.cfainstitute.org/programs/cfa-program', urlVerified: true,
    proves: 'Investment analysis and portfolio management.',
    match: /\bcfa\b/i, fields: ['soc:13-2051', 'soc:13-2052', 'soc:11-3031', 'cp:banking officer'] },
  { id: 'cia', name: 'Certified Internal Auditor (CIA)', issuer: 'The Institute of Internal Auditors (IIA)',
    url: 'https://www.theiia.org/en/certifications/cia/', urlVerified: true,
    proves: 'Internal audit practice and governance.',
    match: /\bcertified internal auditor\b|\bcia\b/i, needsContext: true, fields: ['cp:accountant', 'soc:13-2011'] },
  { id: 'ibb', name: 'Banking Diploma (JAIBB / AIBB)', issuer: 'The Institute of Bankers, Bangladesh (IBB)',
    url: 'https://www.ibb.org.bd/', urlVerified: true,
    proves: 'Bangladesh\'s professional banking qualification, widely valued by local banks.',
    match: /\b(j|d)?aibb\b|\binstitute of bankers\b|\bbanking diploma\b/i,
    fields: ['cp:banking officer', 'soc:13-2072', 'soc:43-3071', 'soc:41-3031'] },

  // ── HR ─────────────────────────────────────────────────────────
  { id: 'cipd', name: 'CIPD Qualification', issuer: 'Chartered Institute of Personnel and Development (CIPD)',
    url: 'https://www.cipd.org/', urlVerified: true,
    proves: 'Professional HR and people-management practice.',
    match: /\bcipd\b/i, fields: ['cp:hr executive', 'soc:13-1071', 'soc:11-3121'] },
  { id: 'shrm', name: 'SHRM-CP / SHRM-SCP', issuer: 'Society for Human Resource Management (SHRM)',
    url: 'https://www.shrm.org/credentials', urlVerified: true,
    proves: 'HR competencies and knowledge.',
    match: /\bshrm[- ]?(s?cp)?\b/i, needsContext: true, fields: ['cp:hr executive', 'soc:13-1071', 'soc:11-3121'] },
  { id: 'phr', name: 'Professional in Human Resources (PHR)', issuer: 'HR Certification Institute (HRCI)',
    url: 'https://www.hrci.org/', urlVerified: true,
    proves: 'Operational HR knowledge.',
    match: /\bs?phr\b/i, needsContext: true, fields: ['cp:hr executive', 'soc:13-1071'] },

  // ── Marketing ──────────────────────────────────────────────────
  { id: 'google-ads', name: 'Google Ads Certification', issuer: 'Google (Skillshop)',
    url: 'https://skillshop.withgoogle.com/', urlVerified: true,
    proves: 'Running and optimising Google Ads campaigns.',
    match: /\bgoogle ads (certifi\w*|certificate)\b|\bskillshop\b/i,
    fields: ['cp:marketing specialist', 'soc:13-1161', 'soc:11-2021'] },
  { id: 'hubspot', name: 'HubSpot Academy Certifications', issuer: 'HubSpot',
    url: 'https://academy.hubspot.com/certification-overview', urlVerified: true,
    proves: 'Inbound marketing, content and CRM practice.',
    match: /\bhubspot (certifi\w*|certificate|academy)\b/i, fields: ['cp:marketing specialist', 'cp:sales executive', 'soc:13-1161'] },
  { id: 'meta-blueprint', name: 'Meta Certification (Blueprint)', issuer: 'Meta',
    url: 'https://www.facebook.com/business/learn/certification', urlVerified: true,
    proves: 'Advertising on Facebook and Instagram.',
    match: /\b(meta|facebook) (blueprint|certified|certifi\w*)\b/i, fields: ['cp:marketing specialist', 'soc:13-1161'] },

  // ── Safety / quality (garments, manufacturing, engineering) ────
  { id: 'iosh', name: 'IOSH Managing Safely', issuer: 'Institution of Occupational Safety and Health (IOSH)',
    url: 'https://iosh.com/', urlVerified: true,
    proves: 'Workplace health and safety management for supervisors and managers.',
    match: /\biosh\b/i, fields: ['soc:29-9011', 'soc:17-2111', 'soc:11-3051', 'soc:51-1011', 'cp:merchandiser'] },
  { id: 'nebosh', name: 'NEBOSH International General Certificate (IGC)', issuer: 'NEBOSH',
    url: 'https://www.nebosh.org.uk/qualifications/international-general-certificate/', urlVerified: true,
    proves: 'Internationally recognised occupational health and safety qualification.',
    match: /\bnebosh\b/i, fields: ['soc:29-9011', 'soc:17-2111', 'soc:11-3051'] },
  { id: 'six-sigma', name: 'Lean Six Sigma (Green / Black Belt)', issuer: 'ASQ (and other accredited bodies)',
    url: 'https://asq.org/cert/six-sigma-green-belt', urlVerified: false,
    proves: 'Process improvement and quality management methods.',
    match: /\bsix sigma\b|\b(green|black|yellow) belt\b/i,
    fields: ['soc:11-3051', 'soc:17-2112', 'soc:13-1082', 'cp:operations executive', 'cp:merchandiser'] },
  { id: 'iso-lead-auditor', name: 'ISO 9001 Lead Auditor (CQI / IRCA)', issuer: 'Chartered Quality Institute (CQI / IRCA)',
    url: 'https://www.quality.org/', urlVerified: false,
    proves: 'Auditing quality management systems against ISO 9001.',
    match: /\biso ?9001 (lead )?auditor\b|\birca\b/i, fields: ['soc:11-3051', 'soc:13-1041', 'cp:merchandiser'] },

  // ── Engineering / design ───────────────────────────────────────
  { id: 'autodesk', name: 'Autodesk Certified Professional (AutoCAD, Revit…)', issuer: 'Autodesk',
    url: 'https://www.autodesk.com/certification/overview', urlVerified: true,
    proves: 'Professional skill in Autodesk design software.',
    match: /\bautodesk certified\b|\bautocad (certifi\w*|certificate)\b/i,
    fields: ['soc:17-2051', 'soc:17-2071', 'soc:17-2141', 'soc:17-3011', 'soc:17-1011'] },
  { id: 'solidworks', name: 'SOLIDWORKS Certification (CSWA / CSWP)', issuer: 'Dassault Systèmes SOLIDWORKS',
    url: 'https://www.solidworks.com/', urlVerified: true,
    proves: '3D CAD design skills in SOLIDWORKS.',
    match: /\bcswa\b|\bcswp\b|\bsolidworks (certifi\w*|certificate)\b/i, fields: ['soc:17-2141', 'soc:17-3013'] },
  { id: 'ieb', name: 'IEB Membership', issuer: 'Institution of Engineers, Bangladesh (IEB)',
    url: 'https://iebbd.org/', urlVerified: true,
    proves: 'Professional engineering membership in Bangladesh.',
    match: /\bieb\b|\binstitution of engineers,? bangladesh\b/i, needsContext: true, fields: ['soc:17-2'] },

  // ── Supply chain / procurement ─────────────────────────────────
  { id: 'cscp', name: 'Certified Supply Chain Professional (CSCP)', issuer: 'ASCM (APICS)',
    url: 'https://www.ascm.org/learning-development/certifications-credentials/cscp/', urlVerified: true,
    proves: 'End-to-end supply chain management.',
    match: /\bcscp\b/i, fields: ['soc:13-1081', 'soc:11-3071', 'cp:merchandiser', 'cp:operations executive'] },
  { id: 'cips', name: 'CIPS Qualifications', issuer: 'Chartered Institute of Procurement & Supply (CIPS)',
    url: 'https://www.cips.org/qualifications', urlVerified: true,
    proves: 'Procurement and supply management.',
    match: /\bcips\b/i, fields: ['soc:13-1023', 'soc:11-3061', 'cp:merchandiser'] },

  // ── Language (often asked across fields) ───────────────────────
  { id: 'ielts', name: 'IELTS', issuer: 'IELTS (British Council / IDP)',
    url: 'https://ielts.org/', urlVerified: true,
    proves: 'English language proficiency.',
    match: /\bielts\b/i, fields: [] },   // never "recognised for your field" — only shown when ads ask for it
];

// Ambiguous acronyms count only near words like these
// (checked in the text around the match, never the acronym itself)
export const CERT_CONTEXT = /certif|qualif|chartered|member|holder|passed|finalist|degree|diploma|professional|accountan|auditor/i;
export const REQUIRED_WORDS  = /\b(must|required|mandatory|essential|compulsory)\b/i;
export const PREFERRED_WORDS = /\b(prefer\w*|advantage|plus|desirable|added|will be considered)\b/i;
