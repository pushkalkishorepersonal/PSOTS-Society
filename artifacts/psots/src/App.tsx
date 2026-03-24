import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AuthProvider } from "./contexts/AuthContext";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { NoticeBoard } from "./pages/NoticeBoard";
import { Events } from "./pages/Events";
import { Marketplace } from "./pages/Marketplace";
import { Contacts } from "./pages/Contacts";
import { CommunityGuide } from "./pages/CommunityGuide";
import { WhatsAppAdmin } from "./pages/WhatsAppAdmin";
import { AuthVerify } from "./pages/AuthVerify";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/notices" component={NoticeBoard} />
        <Route path="/events" component={Events} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/guide" component={CommunityGuide} />
        <Route path="/admin/whatsapp" component={WhatsAppAdmin} />
        <Route path="/auth/verify" component={AuthVerify} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
