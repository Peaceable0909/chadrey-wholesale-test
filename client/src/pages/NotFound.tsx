import { ArrowLeft, Compass } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <main className="confirmation-page">
      <Link href="/" className="back-link"><ArrowLeft size={14} /> Back to Chadrey Wholesale</Link>
      <div className="document-card">
        <span className="success-mark neutral"><Compass size={26} /></span>
        <span className="eyebrow">PAGE NOT FOUND</span>
        <h1>This page has wandered off.</h1>
        <p>The page you're looking for doesn't exist, may have moved, or the link may be out of date.</p>
        <Link href="/" className="button button-primary" style={{ marginTop: 22 }}>Return home</Link>
      </div>
    </main>
  );
}
