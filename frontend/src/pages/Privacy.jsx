import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Zap } from 'lucide-react';

const SECTIONS = [
  { title: 'Information We Collect', content: `We collect information you provide directly: name, email, phone, job title, experience, location, and CV content when you register or use our services.\n\nWe also automatically collect your IP address, browser type, pages viewed, and actions taken within the platform.` },
  { title: 'How We Use Your Information', content: `We use information to: provide and improve CareerPilot; match your profile to job listings; generate ATS scores, cover letters, and career insights; send job alerts and weekly reports; and communicate about your account.\n\nSalary contribution data is aggregated and anonymized. No individual data is ever identifiable in salary insights.` },
  { title: 'CV and Document Storage', content: `Your CV files are stored securely using Cloudflare R2 with AES-256 encryption at rest. Each CV is associated with your account only. We do not share your CV with employers without your explicit action.\n\nYou may delete any stored CV at any time from the CV Studio page. Deletion is permanent and immediate.` },
  { title: 'Data Sharing', content: `We do not sell your personal data. We do not allow advertisers to target you based on your information.\n\nWe may share data with service providers who assist in operating CareerPilot (cloud infrastructure, email delivery) under strict agreements that prohibit any other use.` },
  { title: 'Cookies and Tracking', content: `We use HTTP-only secure cookies for authentication sessions only. These are essential to keeping you logged in.\n\nWe do not use advertising cookies. We use minimal analytics to understand feature usage. You can opt out in account settings.` },
  { title: 'Your Rights (GDPR)', content: `You have the right to:\n\n• Access — request a copy of all data we hold\n• Portability — download your data as JSON from Settings > Privacy\n• Rectification — correct inaccurate data in your profile\n• Erasure — permanently delete your account from Settings > Privacy\n• Restriction — contact us to restrict how we process your data\n\nEmail: privacy@careerpilot.app` },
  { title: 'Data Retention', content: `We retain your data for as long as your account is active. If you delete your account, all personal data is permanently removed within 30 days, except where required for legal or fraud prevention purposes.\n\nApplication logs are retained for 14 days.` },
  { title: 'Security', content: `We implement: TLS encryption for all data in transit; bcrypt password hashing; HTTP-only Secure SameSite cookies; rate limiting on all auth endpoints; OTP verification for new device logins; and regular security reviews.` },
  { title: 'Changes to This Policy', content: `We will notify you of significant changes by email and within CareerPilot at least 7 days before they take effect. Continued use after the effective date constitutes acceptance.` },
  { title: 'Contact Us', content: `Email: privacy@careerpilot.app\nAddress: CareerPilot, Dhaka, Bangladesh\n\nWe respond to all privacy inquiries within 5 business days.` },
];

export default function PrivacyPage() {
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
              <div className="w-10 h-10 rounded-xl bg-brand-purple/15 border border-brand-purple/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-brand-purple" />
              </div>
              <span className="section-label">Legal</span>
            </div>
            <h1 className="font-display font-bold text-4xl text-text-primary">Privacy Policy</h1>
            <p className="text-text-secondary leading-relaxed max-w-2xl">
              CareerPilot is committed to protecting your privacy. This policy explains what data we collect, why, and how you control it.
            </p>
            <p className="text-sm text-text-muted">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="glass-card p-6 border-l-4 border-brand-purple space-y-3">
            <p className="font-semibold text-text-primary">Plain English Summary</p>
            <ul className="space-y-2 text-sm text-text-secondary">
              {['We never sell your data to advertisers or data brokers.', 'Your CV is encrypted and never shared without your action.', 'You can download or delete all your data at any time.', 'We use cookies only for authentication — no ad tracking.', 'Salary contributions are always anonymized and aggregated.'].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-success mt-0.5 shrink-0" />{item}
                </li>
              ))}
            </ul>
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
            <Link to="/terms"  className="hover:text-text-primary transition-colors">Terms of Service</Link>
            <Link to="/"       className="hover:text-text-primary transition-colors">Back to Home</Link>
            <a href="mailto:privacy@careerpilot.app" className="hover:text-text-primary transition-colors">Contact Privacy Team</a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}