import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Route, Switch } from "wouter";
import Home from "./pages/Home";
import Catalogue from "./pages/Catalogue";
import ProductDetail from "./pages/ProductDetail";
import QuoteRequest from "./pages/QuoteRequest";
import CustomerDashboard from "./pages/CustomerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import AdminQuoteComposer from "./pages/AdminQuoteComposer";
import QuotationReview from "./pages/QuotationReview";
import QuoteMessages from "./pages/QuoteMessages";
import OrderTracking from "./pages/OrderTracking";
import AdminFulfilment from "./pages/AdminFulfilment";
import AdminProductCreate from "./pages/AdminProductCreate";
import InvoicePayment from "./pages/InvoicePayment";
import HowItWorks from "./pages/HowItWorks";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/products" component={Catalogue} />
      <Route path="/product" component={ProductDetail} />
      <Route path="/quote" component={QuoteRequest} />
      <Route path="/dashboard" component={CustomerDashboard} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/quote" component={AdminQuoteComposer} />
      <Route path="/quotation" component={QuotationReview} />
      <Route path="/messages" component={QuoteMessages} />
      <Route path="/orders" component={OrderTracking} />
      <Route path="/admin/fulfilment" component={AdminFulfilment} />
      <Route path="/admin/products/new" component={AdminProductCreate} />
      <Route path="/pay" component={InvoicePayment} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/contact" component={Contact} />
      <Route path="/login" component={Login} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
