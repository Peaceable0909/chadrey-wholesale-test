import * as React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/_core/hooks/useAuth";
import { PageLoading } from "@/components/layout/PageState";
import { ScrollManager } from "@/components/layout/ScrollManager";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Route, Switch } from "wouter";
import Home from "./pages/Home";
import Catalogue from "./pages/Catalogue";
import ProductDetail from "./pages/ProductDetail";
import NotFound from "./pages/NotFound";

/**
 * Everything except the browsing pages is loaded when it is first opened, so a visitor who only browses never
 * downloads the admin screens, the product editor or the quote forms.
 * A deploy replaces the page files, so a tab opened before it can fail to find one: reload once to pick up the new site.
 */
function lazyPage(load: () => Promise<{ default: React.ComponentType }>) {
  return React.lazy(async () => {
    try {
      return await load();
    } catch (error) {
      const key = "chadrey-page-reload";
      try {
        if (Date.now() - Number(sessionStorage.getItem(key) ?? 0) > 15_000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
          return await new Promise<never>(() => {});
        }
      } catch {
        // Storage can be unavailable (private browsing); fall through to the error screen.
      }
      throw error;
    }
  });
}

const loaders = {
  QuoteRequest: () => import("./pages/QuoteRequest"),
  Login: () => import("./pages/Login"),
  Contact: () => import("./pages/Contact"),
  HowItWorks: () => import("./pages/HowItWorks"),
  CustomerDashboard: () => import("./pages/CustomerDashboard"),
  CustomerAccount: () => import("./pages/CustomerAccount"),
  QuotationReview: () => import("./pages/QuotationReview"),
  QuoteMessages: () => import("./pages/QuoteMessages"),
  OrderTracking: () => import("./pages/OrderTracking"),
  InvoicePayment: () => import("./pages/InvoicePayment"),
  AdminDashboard: () => import("./pages/AdminDashboard"),
  AdminLogin: () => import("./pages/AdminLogin"),
  AdminProducts: () => import("./pages/AdminProducts"),
  AdminProductCreate: () => import("./pages/AdminProductCreate"),
  AdminQuoteRequests: () => import("./pages/AdminQuoteRequests"),
  AdminQuoteComposer: () => import("./pages/AdminQuoteComposer"),
  AdminFulfilment: () => import("./pages/AdminFulfilment"),
  AdminUsers: () => import("./pages/AdminUsers"),
  AdminAnalytics: () => import("./pages/AdminAnalytics"),
};

const QuoteRequest = lazyPage(loaders.QuoteRequest);
const Login = lazyPage(loaders.Login);
const Contact = lazyPage(loaders.Contact);
const HowItWorks = lazyPage(loaders.HowItWorks);
const CustomerDashboard = lazyPage(loaders.CustomerDashboard);
const CustomerAccount = lazyPage(loaders.CustomerAccount);
const QuotationReview = lazyPage(loaders.QuotationReview);
const QuoteMessages = lazyPage(loaders.QuoteMessages);
const OrderTracking = lazyPage(loaders.OrderTracking);
const InvoicePayment = lazyPage(loaders.InvoicePayment);
const AdminDashboard = lazyPage(loaders.AdminDashboard);
const AdminLogin = lazyPage(loaders.AdminLogin);
const AdminProducts = lazyPage(loaders.AdminProducts);
const AdminProductCreate = lazyPage(loaders.AdminProductCreate);
const AdminQuoteRequests = lazyPage(loaders.AdminQuoteRequests);
const AdminQuoteComposer = lazyPage(loaders.AdminQuoteComposer);
const AdminFulfilment = lazyPage(loaders.AdminFulfilment);
const AdminUsers = lazyPage(loaders.AdminUsers);
const AdminAnalytics = lazyPage(loaders.AdminAnalytics);

/** Once the first page is up and the browser is idle, fetch the pages a shopper is most likely to open next. */
function usePrefetchNextPages() {
  React.useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "")) return;
    const timer = window.setTimeout(() => {
      void loaders.QuoteRequest();
      void loaders.Login();
    }, 4000);
    return () => window.clearTimeout(timer);
  }, []);
}

function Router() {
  usePrefetchNextPages();
  return (
    <React.Suspense fallback={<PageLoading />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/products" component={Catalogue} />
        <Route path="/product" component={ProductDetail} />
        <Route path="/quote" component={QuoteRequest} />
        <Route path="/dashboard" component={CustomerDashboard} />
        <Route path="/account" component={CustomerAccount} />
        <Route path="/addresses" component={CustomerAccount} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/quotes" component={AdminQuoteRequests} />
        <Route path="/admin/quote" component={AdminQuoteComposer} />
        <Route path="/quotation" component={QuotationReview} />
        <Route path="/messages" component={QuoteMessages} />
        <Route path="/orders" component={OrderTracking} />
        <Route path="/admin/fulfilment" component={AdminFulfilment} />
        <Route path="/admin/products" component={AdminProducts} />
        <Route path="/admin/products/new" component={AdminProductCreate} />
        <Route path="/pay" component={InvoicePayment} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/contact" component={Contact} />
        <Route path="/login" component={Login} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </React.Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster position="top-center" />
            <ScrollManager />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
