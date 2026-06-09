import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Zap } from 'lucide-react';

const SECTIONS = [
  { title: 'Acceptance of Terms', content: `By accessing or using CareerPilot, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, do not use CareerPilot.` },
  { title: 'Description of Service', content: `CareerPilot is an AI-powered career intelligence platform providing job matching, CV analysis, interview preparation, salary insights, and career coaching. We aggregate job listings from multiple sources for informational purposes.\n\nWe reserve the right to modify, suspend, or discontinue any feature at any time with reasonable notice.` },
  { title: 'User Accounts', content: `You must provide accurate, complete, and current information when creating your account. You are responsible for maintaining the confidentiality of your credentials and for all activities under your account.\n\nNotify us immediately of any unauthorized use. Accounts are for individual use only.` },
  { title: 'Acceptable Use', content: `You agree not to:\n\n• Use CareerPilot for any unlawful purpose\n• Submit false, misleading, or fraudulent information\n• Attempt to gain unauthorized access to any part of the platform\n• Use automated tools or scrapers against CareerPilot's systems\n• Upload malicious files or content\n• Impersonate another person or entity` },
  { title: 'Content You Submit', content: `When you upload a CV, submit salary data, or contribute interview experiences, you grant CareerPilot a non-exclusive license to process that content solely to provide our services.\n\nSalary contributions are anonymized before being displayed. You retain ownership of your CV and personal documents.` },
  { title: 'AI-Generated Content', content: `CareerPilot uses AI to generate ATS scores, cover letters, skill recommendations, and career advice. This content is for informational purposes only and does not constitute professional career, legal, or financial advice.\n\nAI-estimated data (such as salary estimates) is clearly labeled throughout the platform.` },
  { title: 'Job Listings', content: `Job listings are aggregated from LinkedIn (via authorized API), Indeed, Bdjobs, and Rozee. We do not guarantee the accuracy or availability of any listing.\n\nCareerPilot is not a recruitment agency. Applying to a job opens the employer's original listing. Any communication with employers is solely between you and the employer.` },
  { title: 'Subscriptions and Payments', content: `CareerPilot currently offers all core features for free. Pro subscription features are built but not yet enabled. When Pro features are activated, this section will be updated with full pricing and payment terms.\n\nPayment processing will be handled through bKash, Nagad, and Stripe. All prices will be in BDT (৳).` },
  { title: 'Limitation of Liability', content: `To the maximum extent permitted by law, CareerPilot shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the platform.\n\nOur total liability for any claim shall not exceed the amount you paid us in the 12 months preceding the claim.` },
  { title: 'Termination', content: `You may delete your account at any time from Settings > Privacy. Your personal data will be permanently removed within 30 days.\n\nWe may suspend or terminate your account if you violate these terms. You may appeal by contacting support@careerpilot.app.` },
  { title: 'Governing Law', content: `These Terms are governed by the laws of Bangladesh. Any disputes shall be subject to the exclusive jurisdiction of the courts of Dhaka, Bangladesh.` },
  { title: 'Changes to Terms', content: `We will notify you of material changes at least 7 days before they take effect by email and within the platform. Continued use after the effective date constitutes acceptance.` },
  { title: 'Contact', content: `Email: legal@careerpilot.app\nAddress: CareerPilot, Dhaka, Bangladesh` },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="border-b border-border bg-bg-secondary/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-brand-gradient flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-bold text-text-primary">CareerPilot</span>
          </div>
          <Link to="/" className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />Back to Home
          </Link>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-brand-cyan" />
              </div>
              <span className="section-label">Legal</span>
            </div>
            <h1 className="font-display font-bold text-4xl text-text-primary">Terms of Service</h1>
            <p className="text-text-secondary leading-relaxed max-w-2xl">
              Please read these terms carefully before using CareerPilot. They explain your rights and responsibilities.
            </p>
            <p className="text-sm text-text-muted">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="space-y-10">
            {SECTIONS.map((section, i) => (
              <div key={section.title} className="space-y-4">
                <h2 className="font-display font-semibold text-xl text-text-primary flex items-center gap-3">
                  <span className="text-xs font-mono text-text-muted w-6">{String(i + 1).padStart(2, '0')}</span>
                  {section.title}
                </h2>
                <div className="pl-9">
                  <p className="text-text-secondary leading-relaxed text-sm whitespace-pre-line">{section.content}</p>
                </div>
                {i < SECTIONS.length - 1 && <div className="border-b border-border ml-9" />}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 pt-8 border-t border-border text-sm text-text-secondary">
            <Link to="/privacy" className="hover:text-text-primary transition-colors">Privacy Policy</Link>
            <Link to="/"        className="hover:text-text-primary transition-colors">Back to Home</Link>
            <a href="mailto:legal@careerpilot.app" className="hover:text-text-primary transition-colors">Contact Legal Team</a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}