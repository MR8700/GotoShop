import React, { useState, useEffect } from "react";
import {
  fetchSuperAdminMe,
  loginSuperAdmin,
  logoutSuperAdmin,
  fetchSuperAdminOverview,
  fetchSuperAdminStores,
  createSuperAdminStore,
  updateSuperAdminStoreStatus,
  impersonateStoreOwner,
  deleteSuperAdminStore,
  setActiveStoreSlug,
  fetchSuperAdminSubRequests,
  reviewSuperAdminSubRequest,
  fetchSuperAdminPlans,
  updateSuperAdminPlan,
  fetchSuperAdminUssdConfigs,
  updateSuperAdminUssdConfig,
  getMediaUrl,
} from "../api/client";

export default function SuperAdminDashboard({ onClose, onSwitchStore }) {
  const [auth, setAuth] = useState({ is_authenticated: false, admin: null });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Tabs: "stores", "requests", "configs"
  const [superTab, setSuperTab] = useState("stores");

  const [overview, setOverview] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Subscription Requests State
  const [subRequests, setSubRequests] = useState([]);
  const [subFilter, setSubFilter] = useState("PENDING");
  const [adminPlans, setAdminPlans] = useState([]);
  const [adminUssdConfigs, setAdminUssdConfigs] = useState([]);

  // Modals & Handover
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [selectedStoreForSub, setSelectedStoreForSub] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [zoomProofUrl, setZoomProofUrl] = useState(null);
  const [credentialsHandover, setCredentialsHandover] = useState(null);
  const [rejectionModalReq, setRejectionModalReq] = useState(null);
  const [rejectionReasonText, setRejectionReasonText] = useState("");

  // New Store Form
  const [newStore, setNewStore] = useState({
    name: "",
    slug: "",
    owner_name: "",
    owner_email: "",
    owner_phone: "+226 ",
    password: "",
    delivery_city: "Ouagadougou",
    subscription_plan: "PRO",
    trial_days: 30,
    primary_color: "#ec761e",
    theme_preset: "kinetic_amber",
  });

  // Edit Subscription Form
  const [subForm, setSubForm] = useState({
    subscription_status: "ACTIVE",
    subscription_plan: "PRO",
    extend_days: 30,
  });

  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const res = await fetchSuperAdminMe();
      if (res && res.is_authenticated) {
        setAuth({ is_authenticated: true, admin: res.admin });
        await loadDashboardData();
      } else {
        setAuth({ is_authenticated: false, admin: null });
      }
    } catch (e) {
      setAuth({ is_authenticated: false, admin: null });
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [ov, stList, reqs, pls, ussds] = await Promise.all([
        fetchSuperAdminOverview(),
        fetchSuperAdminStores(),
        fetchSuperAdminSubRequests("ALL").catch(() => []),
        fetchSuperAdminPlans().catch(() => []),
        fetchSuperAdminUssdConfigs().catch(() => []),
      ]);
      setOverview(ov);
      setStores(stList);
      setSubRequests(reqs || []);
      setAdminPlans(pls || []);
      setAdminUssdConfigs(ussds || []);
    } catch (e) {
      showToast("Erreur de chargement des données: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await loginSuperAdmin(loginEmail, loginPassword);
      setAuth({ is_authenticated: true, admin: res.admin });
      showToast("Connexion Super-Admin réussie !");
      await loadDashboardData();
    } catch (err) {
      setLoginError(err.message || "Identifiants incorrects");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutSuperAdmin();
    setAuth({ is_authenticated: false, admin: null });
    showToast("Déconnexion effectuée");
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!newStore.name || !newStore.owner_name || !newStore.owner_email) {
      alert("Veuillez renseigner les champs obligatoires (nom, gérant, email).");
      return;
    }
    setActionLoading(true);
    try {
      const created = await createSuperAdminStore(newStore);
      showToast(`Boutique "${created.name}" créée avec succès !`);
      setIsCreateOpen(false);
      setNewStore({
        name: "",
        slug: "",
        owner_name: "",
        owner_email: "",
        owner_phone: "+225 ",
        password: "Marchand2026!",
        delivery_city: "Abidjan (Cocody)",
        subscription_plan: "PRO",
        trial_days: 30,
        primary_color: "#ec761e",
        theme_preset: "kinetic_amber",
      });
      await loadDashboardData();
    } catch (err) {
      alert(err.message || "Erreur lors de la création de la boutique");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenSubModal = (st) => {
    setSelectedStoreForSub(st);
    setSubForm({
      subscription_status: st.subscription_status || "ACTIVE",
      subscription_plan: st.subscription_plan || "PRO",
      extend_days: 30,
    });
    setIsSubModalOpen(true);
  };

  const handleUpdateSubscription = async (e) => {
    e.preventDefault();
    if (!selectedStoreForSub) return;
    setActionLoading(true);
    try {
      await updateSuperAdminStoreStatus(selectedStoreForSub.id, subForm);
      showToast("Abonnement mis à jour avec succès !");
      setIsSubModalOpen(false);
      await loadDashboardData();
    } catch (err) {
      alert(err.message || "Erreur de mise à jour");
    } finally {
      setActionLoading(false);
    }
  };

  const handleImpersonate = async (st) => {
    try {
      const res = await impersonateStoreOwner(st.id);
      if (res && res.session_token) {
        // Store merchant auth token
        localStorage.setItem("conversastore_owner_token", res.session_token);
        // Switch active store
        setActiveStoreSlug(st.slug);
        showToast(`Connexion directe à la boutique "${st.name}"...`);
        if (onSwitchStore) {
          onSwitchStore(st.slug, true); // true = open admin
        } else {
          window.location.href = `/?store=${st.slug}&view=admin`;
        }
      }
    } catch (err) {
      alert(err.message || "Erreur de connexion");
    }
  };

  const handleViewVitrine = (st) => {
    setActiveStoreSlug(st.slug);
    if (onSwitchStore) {
      onSwitchStore(st.slug, false);
    } else {
      window.location.href = `/?store=${st.slug}`;
    }
  };

  const handleDelete = async (st) => {
    if (st.slug === "faso-danfani") {
      alert("La boutique principale ne peut pas être supprimée.");
      return;
    }
    const ok = window.confirm(`Êtes-vous certain de vouloir supprimer définitivement la boutique "${st.name}" ? Toutes ses données seront effacées.`);
    if (!ok) return;

    try {
      await deleteSuperAdminStore(st.id);
      showToast("Boutique supprimée");
      await loadDashboardData();
    } catch (err) {
      alert(err.message || "Erreur de suppression");
    }
  };

  // Subscription Handlers
  const handleApproveSubRequest = async (reqItem) => {
    const ok = window.confirm(
      `Confirmer la réception du paiement Mobile Money de ${reqItem.amount} ${reqItem.currency} pour la boutique "${reqItem.store_name}" (${reqItem.request_type}) ?`
    );
    if (!ok) return;

    setActionLoading(true);
    try {
      const res = await reviewSuperAdminSubRequest(reqItem.id, {
        status: "APPROVED",
        notes: "Paiement Mobile Money vérifié et validé par le Super-Admin.",
      });
      showToast(`Demande de "${reqItem.store_name}" validée avec succès !`);

      if (res.request_type === "NEW_STORE" && res.generated_password) {
        setCredentialsHandover(res);
      }
      await loadDashboardData();
    } catch (e) {
      alert(e.message || "Erreur lors de la validation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenRejectModal = (reqItem) => {
    setRejectionModalReq(reqItem);
    setRejectionReasonText("Capture de paiement illisible ou montant non reçu sur le compte marchand.");
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectionModalReq) return;
    setActionLoading(true);
    try {
      await reviewSuperAdminSubRequest(rejectionModalReq.id, {
        status: "REJECTED",
        rejection_reason: rejectionReasonText.trim() || "Paiement non confirmé",
      });
      showToast(`Demande de "${rejectionModalReq.store_name}" rejetée.`);
      setRejectionModalReq(null);
      await loadDashboardData();
    } catch (e) {
      alert(e.message || "Erreur lors du rejet");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveUssdConfig = async (cfgId, updatedData) => {
    setActionLoading(true);
    try {
      await updateSuperAdminUssdConfig(cfgId, updatedData);
      showToast("Configuration USSD enregistrée avec succès !");
      await loadDashboardData();
    } catch (e) {
      alert(e.message || "Erreur mise à jour USSD");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSavePlanPrice = async (planId, newPrice) => {
    setActionLoading(true);
    try {
      await updateSuperAdminPlan(planId, { price: parseInt(newPrice) || 1000 });
      showToast("Tarif du forfait mis à jour !");
      await loadDashboardData();
    } catch (e) {
      alert(e.message || "Erreur mise à jour forfait");
    } finally {
      setActionLoading(false);
    }
  };

  const pendingRequestsCount = subRequests.filter((r) => r.status === "PENDING").length;

  const filteredRequests = subRequests.filter((r) => {
    if (subFilter !== "ALL" && r.status !== subFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        r.store_name.toLowerCase().includes(q) ||
        r.owner_name.toLowerCase().includes(q) ||
        r.owner_email.toLowerCase().includes(q) ||
        r.owner_phone.toLowerCase().includes(q) ||
        r.plan_code.toLowerCase().includes(q) ||
        r.operator_code.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredStores = stores.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.owner_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.owner_phone.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === "ALL") return true;
    return s.subscription_status === statusFilter;
  });

  // Login Screen if not logged in
  if (!auth.is_authenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl"></div>
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-3 shadow-inner">
              <span className="material-symbols-outlined text-3xl">hub</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">ConversaStore Platform</h1>
            <p className="text-xs text-slate-400 mt-1">Super-Admin Console & Gestion Multi-Boutiques</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Administrateur</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mot de passe Super-Admin</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loginLoading ? (
                <span>Connexion en cours...</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">lock_open</span>
                  <span>Accéder à la Console Platform</span>
                </>
              )}
            </button>
          </form>

          {onClose && (
            <button
              onClick={onClose}
              className="w-full mt-4 py-2 text-xs text-slate-400 hover:text-white transition text-center"
            >
              ← Retour à la boutique
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-amber-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-2xl text-xs flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-lg">verified</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black shadow-inner">
              <span className="material-symbols-outlined text-2xl">hub</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-base tracking-tight">ConversaStore Platform</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  SUPER-ADMIN
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Architecture Multi-Boutiques & Sous-Domaines</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition border border-slate-700"
            >
              <span className="material-symbols-outlined text-sm">store</span>
              <span>Boutique Vitrine</span>
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-400 transition border border-red-500/20"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 pt-6 space-y-6">
        {/* Network KPIs Row */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Total Boutiques</span>
                <span className="material-symbols-outlined text-amber-400 text-xl">storefront</span>
              </div>
              <div className="text-2xl font-extrabold text-white">{overview.total_stores_count}</div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <span className="text-emerald-400 font-bold">{overview.active_stores_count} actives</span> •{" "}
                <span className="text-amber-400 font-bold">{overview.trial_stores_count} en essai</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Volume Global (GMV)</span>
                <span className="material-symbols-outlined text-emerald-400 text-xl">payments</span>
              </div>
              <div className="text-2xl font-extrabold text-emerald-400">
                {overview.total_gmv_network?.toLocaleString()} <span className="text-xs text-emerald-300">FCFA</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Chiffre d'affaires cumulé du réseau</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Commandes Totales</span>
                <span className="material-symbols-outlined text-blue-400 text-xl">shopping_cart</span>
              </div>
              <div className="text-2xl font-extrabold text-white">{overview.total_orders_network}</div>
              <p className="text-[11px] text-slate-400 mt-1">Flux WhatsApp & direct générés</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Catalogue Réseau</span>
                <span className="material-symbols-outlined text-purple-400 text-xl">inventory_2</span>
              </div>
              <div className="text-2xl font-extrabold text-white">{overview.total_products_network}</div>
              <p className="text-[11px] text-slate-400 mt-1">Articles en vente actifs</p>
            </div>
          </div>
        )}

        {/* Super-Admin Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          <button
            onClick={() => setSuperTab("stores")}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 whitespace-nowrap ${
              superTab === "stores"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <span className="material-symbols-outlined text-base">storefront</span>
            <span>Boutiques & Réseau ({stores.length})</span>
          </button>

          <button
            onClick={() => setSuperTab("requests")}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 whitespace-nowrap relative ${
              superTab === "requests"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            <span>Demandes d'Abonnement & Reçus</span>
            {pendingRequestsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                {pendingRequestsCount} en attente
              </span>
            )}
          </button>

          <button
            onClick={() => setSuperTab("configs")}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 whitespace-nowrap ${
              superTab === "configs"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <span className="material-symbols-outlined text-base">tune</span>
            <span>Configuration USSD & Forfaits</span>
          </button>
        </div>

        {/* TAB 1: STORES & NETWORK */}
        {superTab === "stores" && (
          <div className="space-y-6">
            {/* Subdomains & Multi-Tenant Routing Explainer Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/20 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">dns</span>
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Routage Multi-Boutiques & Multi-Tenancy</h3>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Chaque commerçant possède un espace 100% étanche. Accessible via le paramètre{" "}
                    <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[11px]">?store=[slug]</code>{" "}
                    ou sous-domaine direct <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[11px]">[slug].gotoshop.com</code>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="w-full md:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 shrink-0"
              >
                <span className="material-symbols-outlined text-base">add_business</span>
                <span>+ Inscrire un Commerçant</span>
              </button>
            </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-base">search</span>
            <input
              type="text"
              placeholder="Rechercher une boutique, commerçant, slug, email, téléphone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { key: "ALL", label: "Toutes" },
              { key: "ACTIVE", label: "Actives" },
              { key: "TRIAL", label: "En Essai" },
              { key: "SUSPENDED", label: "Suspendues" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  statusFilter === f.key
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stores Table / Cards */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Chargement des boutiques...</div>
        ) : filteredStores.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-sm">
            Aucune boutique ne correspond à votre recherche.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredStores.map((st) => {
              const isActive = st.subscription_status === "ACTIVE";
              const isTrial = st.subscription_status === "TRIAL";
              const isSuspended = st.subscription_status === "SUSPENDED";

              return (
                <div
                  key={st.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                >
                  {/* Left: Brand Identity & Subdomain */}
                  <div className="flex items-start gap-3.5 min-w-[280px]">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-inner shrink-0"
                      style={{ backgroundColor: st.primary_color || "#ec761e" }}
                    >
                      {st.name ? st.name.charAt(0).toUpperCase() : "B"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-white text-sm">{st.name}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isActive
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : isTrial
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}
                        >
                          {st.subscription_status}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {st.subscription_plan}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="font-mono text-[11px] text-amber-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                          ?store={st.slug}
                        </span>
                        <span>•</span>
                        <span>{st.currency}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Owner Details */}
                  <div className="text-xs space-y-0.5 min-w-[200px]">
                    <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-400 text-sm">person</span>
                      <span>{st.owner_name}</span>
                    </div>
                    <div className="text-slate-400 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-500 text-sm">mail</span>
                      <span>{st.owner_email}</span>
                    </div>
                    <div className="text-slate-400 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-emerald-400 text-sm">call</span>
                      <span>{st.owner_phone}</span>
                    </div>
                  </div>

                  {/* Metrics: Products & Orders */}
                  <div className="flex items-center gap-4 text-xs bg-slate-950/60 border border-slate-800/60 rounded-xl px-3 py-2">
                    <div className="text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">Articles</div>
                      <div className="font-extrabold text-white text-sm">{st.products_count}</div>
                    </div>
                    <div className="w-[1px] h-6 bg-slate-800"></div>
                    <div className="text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">Commandes</div>
                      <div className="font-extrabold text-white text-sm">{st.orders_count}</div>
                    </div>
                    <div className="w-[1px] h-6 bg-slate-800"></div>
                    <div className="text-center">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">CA Cumulé</div>
                      <div className="font-extrabold text-emerald-400 text-sm">
                        {st.total_revenue?.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
                    <button
                      onClick={() => handleViewVitrine(st)}
                      title="Ouvrir la vitrine client"
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition border border-slate-700 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      <span>Vitrine</span>
                    </button>

                    <button
                      onClick={() => handleImpersonate(st)}
                      title="Se connecter directement dans l'espace commerçant"
                      className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-400 transition border border-amber-500/30 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">key</span>
                      <span>Gérer</span>
                    </button>

                    <button
                      onClick={() => handleOpenSubModal(st)}
                      title="Gérer l'abonnement et la durée"
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition border border-slate-700 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">tune</span>
                      <span>Forfait</span>
                    </button>

                    {st.slug !== "faso-danfani" && (
                      <button
                        onClick={() => handleDelete(st)}
                        title="Supprimer la boutique"
                        className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs text-red-400 transition border border-red-500/20"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

    {/* TAB 2: DEMANDES D'ABONNEMENT & REÇUS */}
    {superTab === "requests" && (
      <div className="space-y-4">
        {/* Top Filter & Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div>
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              <span>Demandes d'Abonnement & Preuves de Paiement</span>
              {pendingRequestsCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse">
                  {pendingRequestsCount} en attente
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Vérifiez les captures d'écran des transferts Orange Money et Moov Money avant de valider l'accès.
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { key: "PENDING", label: `En Attente (${pendingRequestsCount})` },
              { key: "ALL", label: `Toutes (${subRequests.length})` },
              { key: "APPROVED", label: "Validées" },
              { key: "REJECTED", label: "Rejetées" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setSubFilter(f.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  subFilter === f.key
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Chargement des demandes...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-sm space-y-1">
            <p className="font-bold text-white">Aucune demande trouvée pour ce filtre.</p>
            <p className="text-xs text-slate-500">Les nouvelles inscriptions et renouvellements avec reçu apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((req) => {
              const isPending = req.status === "PENDING";
              const isApproved = req.status === "APPROVED";
              const isRejected = req.status === "REJECTED";

              const cleanPhone = (req.owner_phone || "").replace(/[^0-9]/g, "");
              const whatsappWelcome = `Bonjour ${req.owner_name} ! Votre boutique "${req.store_name}" sur GotoShop est activée avec succès !\n\n` +
                `Voici vos identifiants pour administrer votre boutique :\n` +
                `👉 Accès Gérant : ${window.location.origin}/#admin\n` +
                `👉 Email : ${req.owner_email}\n` +
                (req.generated_password ? `👉 Mot de passe : ${req.generated_password}\n\n` : "\n") +
                `Lien public de votre vitrine : ${window.location.origin}/?store=${req.store_name.toLowerCase().replace(/[^a-z0-9]/g, "-")}\n\n` +
                `Bienvenue sur GotoShop !`;

              const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappWelcome)}`;

              return (
                <div
                  key={req.id}
                  className={`bg-slate-900 border rounded-2xl p-4 transition shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 ${
                    isPending ? "border-amber-500/40 shadow-amber-950/20" : "border-slate-800"
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-[280px]">
                    <div
                      onClick={() => setZoomProofUrl(getMediaUrl(req.payment_proof_url))}
                      className="w-16 h-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-800 shrink-0 relative cursor-pointer group shadow-sm hover:border-amber-500 transition"
                      title="Cliquer pour agrandir le reçu"
                    >
                      <img
                        src={getMediaUrl(req.payment_proof_url)}
                        alt="Reçu"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/media/store/logo.jpg";
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                        🔍
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-white text-sm">{req.store_name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          req.request_type === "NEW_STORE"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}>
                          {req.request_type === "NEW_STORE" ? "⭐ NOUVELLE BOUTIQUE" : "🔄 RENOUVELLEMENT"}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isPending
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                            : isApproved
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}>
                          {isPending ? "⏳ EN ATTENTE" : isApproved ? "✓ VALIDÉ" : "✕ REJETÉ"}
                        </span>
                      </div>

                      <div className="text-xs text-slate-300">
                        <span className="font-semibold text-white">{req.owner_name}</span> •{" "}
                        <a
                          href={`https://wa.me/${cleanPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 font-mono hover:underline"
                        >
                          {req.owner_phone}
                        </a>{" "}
                        {req.owner_email ? `• ${req.owner_email}` : ""}
                      </div>

                      <div className="flex items-center gap-2 text-xs flex-wrap pt-0.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold border border-slate-700">
                          {req.plan_name} • {req.amount} {req.currency}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-[11px] font-semibold text-white"
                          style={{
                            backgroundColor:
                              req.operator_code === "ORANGE"
                                ? "#FF7900"
                                : req.operator_code === "MOOV"
                                ? "#005BAA"
                                : "#0284c7",
                          }}
                        >
                          {req.operator_code === "ORANGE" ? "Orange Money" : req.operator_code === "MOOV" ? "Moov Money" : "Wave"}
                        </span>
                        {req.ussd_code_used && (
                          <span className="font-mono text-[10px] text-slate-400">
                            Code : {req.ussd_code_used}
                          </span>
                        )}
                      </div>

                      {req.notes && (
                        <p className="text-[11px] text-slate-400 italic">
                          Note client : "{req.notes}"
                        </p>
                      )}

                      {req.rejection_reason && (
                        <p className="text-[11px] text-rose-400 font-medium">
                          Motif rejet : {req.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
                    {isPending && (
                      <>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleApproveSubRequest(req)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 flex items-center gap-1.5 transition-all"
                        >
                          <span>✓ Valider & Activer</span>
                        </button>

                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleOpenRejectModal(req)}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-600/20 text-rose-400 border border-rose-500/30 font-semibold text-xs transition-all"
                        >
                          <span>Rejeter</span>
                        </button>
                      </>
                    )}

                    {isApproved && (
                      <div className="flex items-center gap-2">
                        <a
                          href={whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                          title="Envoyer les accès sur WhatsApp"
                        >
                          <span>📲 Envoyer sur WhatsApp</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

    {/* TAB 3: CONFIGURATION USSD & FORFAITS */}
    {superTab === "configs" && (
      <div className="space-y-6">
        {/* USSD Gateways */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-white text-base">Passerelles USSD de Paiement</h3>
              <p className="text-xs text-slate-400">
                Configurez les numéros marchands et codes USSD pour Orange Money et Moov Money.
              </p>
            </div>
            <span className="material-symbols-outlined text-amber-400 text-2xl">dialpad</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adminUssdConfigs.map((cfg) => {
              const isOrange = cfg.operator_code === "ORANGE";
              const isMoov = cfg.operator_code === "MOOV";
              return (
                <div
                  key={cfg.id}
                  className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shadow-sm"
                        style={{
                          backgroundColor:
                            cfg.brand_color || (isOrange ? "#FF7900" : isMoov ? "#005BAA" : "#0284c7"),
                        }}
                      >
                        {isOrange ? "OM" : isMoov ? "MOOV" : "WAVE"}
                      </div>
                      <span className="font-extrabold text-white text-sm">{cfg.operator_name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">{cfg.operator_code}</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Numéro Marchand / Récepteur :
                      </label>
                      <input
                        type="text"
                        defaultValue={cfg.merchant_number}
                        id={`merchant_${cfg.id}`}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Modèle de Code USSD :
                      </label>
                      <input
                        type="text"
                        defaultValue={cfg.ussd_template}
                        id={`template_${cfg.id}`}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono focus:outline-none focus:border-amber-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Variables : <code>&#123;merchant_number&#125;</code> et <code>&#123;amount&#125;</code>
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Instructions affichées au commerçant :
                      </label>
                      <textarea
                        rows={2}
                        defaultValue={cfg.instructions}
                        id={`instructions_${cfg.id}`}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 resize-none"
                      />
                    </div>

                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => {
                          const num = document.getElementById(`merchant_${cfg.id}`)?.value;
                          const tmpl = document.getElementById(`template_${cfg.id}`)?.value;
                          const inst = document.getElementById(`instructions_${cfg.id}`)?.value;
                          handleSaveUssdConfig(cfg.id, {
                            merchant_number: num,
                            ussd_template: tmpl,
                            instructions: inst,
                          });
                        }}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
                      >
                        Enregistrer {cfg.operator_name}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pricing Plans */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-white text-base">Tarification des Formules</h3>
              <p className="text-xs text-slate-400">
                Ajustez le tarif mensuel en FCFA pour chaque type d'abonnement.
              </p>
            </div>
            <span className="material-symbols-outlined text-amber-400 text-2xl">loyalty</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {adminPlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-white text-sm">{plan.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">
                      {plan.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">{plan.description}</p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-700/60">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Tarif (FCFA / 30 jours) :
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      defaultValue={plan.price}
                      id={`plan_price_${plan.id}`}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-black focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => {
                        const priceVal = document.getElementById(`plan_price_${plan.id}`)?.value;
                        handleSavePlanPrice(plan.id, priceVal);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs shrink-0"
                    >
                      Valider
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
      </main>

      {/* Modal Inscription / Création de Boutique */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-white text-base">Inscrire un Nouveau Commerçant</h3>
                <p className="text-xs text-slate-400">Génération de la boutique, du sous-domaine et des accès</p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nom de la Boutique *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Boubou Royal Dakar"
                    value={newStore.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewStore({
                        ...newStore,
                        name: val,
                        slug: newStore.slug || val.toLowerCase().replace(/[^a-z0-9]/g, "-"),
                      });
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Sous-domaine / Slug *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: boubou-royal"
                    value={newStore.slug}
                    onChange={(e) => setNewStore({ ...newStore, slug: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none font-mono"
                  />
                  <p className="text-[10px] text-amber-400 mt-1">
                    URL d'accès : ?store={newStore.slug || "slug"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nom du Commerçant *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Fatou Ndiaye"
                    value={newStore.owner_name}
                    onChange={(e) => setNewStore({ ...newStore, owner_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Téléphone / WhatsApp Direct *</label>
                  <input
                    type="text"
                    required
                    placeholder="+221 77 123 45 67"
                    value={newStore.owner_phone}
                    onChange={(e) => setNewStore({ ...newStore, owner_phone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email de Connexion *</label>
                  <input
                    type="email"
                    required
                    placeholder="fatou@boubouroyal.sn"
                    value={newStore.owner_email}
                    onChange={(e) => setNewStore({ ...newStore, owner_email: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mot de Passe Initial</label>
                  <input
                    type="text"
                    required
                    value={newStore.password}
                    onChange={(e) => setNewStore({ ...newStore, password: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Ville de Livraison</label>
                  <input
                    type="text"
                    value={newStore.delivery_city}
                    onChange={(e) => setNewStore({ ...newStore, delivery_city: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Formule / Plan</label>
                  <select
                    value={newStore.subscription_plan}
                    onChange={(e) => setNewStore({ ...newStore, subscription_plan: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                  >
                    <option value="STARTER">Starter (5 000 F/m)</option>
                    <option value="PRO">Pro VIP (15 000 F/m)</option>
                    <option value="VIP">Élite Sur-Mesure</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Période d'Essai</label>
                  <select
                    value={newStore.trial_days}
                    onChange={(e) => setNewStore({ ...newStore, trial_days: parseInt(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                  >
                    <option value="14">14 jours gratuits</option>
                    <option value="30">30 jours gratuits</option>
                    <option value="60">60 jours gratuits</option>
                    <option value="0">Actif immédiatement</option>
                  </select>
                </div>
              </div>

              {/* Color Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Couleur Principale</label>
                <div className="flex items-center gap-2">
                  {[
                    { color: "#ec761e", label: "Ambre" },
                    { color: "#10B981", label: "Émeraude" },
                    { color: "#3B82F6", label: "Saphir" },
                    { color: "#8B5CF6", label: "Améthyste" },
                    { color: "#EC4899", label: "Rose" },
                    { color: "#D97706", label: "Or" },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setNewStore({ ...newStore, primary_color: c.color })}
                      className={`w-7 h-7 rounded-full border-2 transition ${
                        newStore.primary_color === c.color ? "border-white scale-110 shadow-md" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                    />
                  ))}
                  <input
                    type="text"
                    value={newStore.primary_color}
                    onChange={(e) => setNewStore({ ...newStore, primary_color: e.target.value })}
                    className="w-24 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1 text-xs text-white font-mono text-center"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                  <span>Créer la Boutique</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Abonnement & Statut */}
      {isSubModalOpen && selectedStoreForSub && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-white text-base">Abonnement • {selectedStoreForSub.name}</h3>
                <p className="text-xs text-slate-400">Modifier le statut ou prolonger la validité</p>
              </div>
              <button
                onClick={() => setIsSubModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdateSubscription} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Statut d'Accès</label>
                <select
                  value={subForm.subscription_status}
                  onChange={(e) => setSubForm({ ...subForm, subscription_status: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500"
                >
                  <option value="ACTIVE">ACTIF (Boutique ouverte et fonctionnelle)</option>
                  <option value="TRIAL">EN ESSAI (Période gratuite)</option>
                  <option value="SUSPENDED">SUSPENDU (Impayé / Désactivé)</option>
                  <option value="EXPIRED">EXPIRÉ (Renouvellement requis)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Formule Abonnement</label>
                <select
                  value={subForm.subscription_plan}
                  onChange={(e) => setSubForm({ ...subForm, subscription_plan: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500"
                >
                  <option value="STARTER">Starter</option>
                  <option value="PRO">Pro VIP</option>
                  <option value="VIP">Élite Entreprise</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Prolonger la validité de :</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { days: 30, label: "+30 jours" },
                    { days: 90, label: "+3 mois" },
                    { days: 365, label: "+1 an" },
                  ].map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => setSubForm({ ...subForm, extend_days: p.days })}
                      className={`py-2 text-xs font-bold rounded-xl border transition ${
                        subForm.extend_days === p.days
                          ? "bg-amber-500/20 text-amber-400 border-amber-500"
                          : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Zoom Capture Reçu */}
      {zoomProofUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl p-4 flex flex-col items-center">
            <div className="w-full flex justify-between items-center pb-3 border-b border-slate-800">
              <span className="font-extrabold text-white text-sm">Preuve de Paiement Mobile Money</span>
              <button
                onClick={() => setZoomProofUrl(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>
            <div className="py-4 max-h-[75vh] overflow-auto flex items-center justify-center w-full">
              <img
                src={zoomProofUrl}
                alt="Preuve de Paiement"
                className="max-w-full max-h-[70vh] rounded-xl object-contain shadow"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Remise des Identifiants & Envoi WhatsApp Direct */}
      {credentialsHandover && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-2xl mx-auto shadow-lg shadow-emerald-950">
              ✓
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white">Boutique Créée & Validée !</h3>
              <p className="text-xs text-slate-300">
                La boutique "{credentialsHandover.store_name}" est désormais active.
              </p>
            </div>

            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-700">
                <span className="text-slate-400">Commerçant :</span>
                <span className="font-bold text-white">{credentialsHandover.owner_name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-700">
                <span className="text-slate-400">Identifiant (Email) :</span>
                <span className="font-mono text-amber-300 font-bold">{credentialsHandover.owner_email}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-700">
                <span className="text-slate-400">Mot de passe temporaire :</span>
                <span className="font-mono text-emerald-400 font-bold select-all bg-slate-900 px-2 py-0.5 rounded">
                  {credentialsHandover.generated_password}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Lien d'administration :</span>
                <span className="font-mono text-slate-300 truncate max-w-[180px]">
                  {window.location.origin}/#admin
                </span>
              </div>
            </div>

            {/* Direct WhatsApp Send Action */}
            <div className="space-y-2 pt-2">
              <a
                href={`https://wa.me/${(credentialsHandover.owner_phone || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  `Bonjour ${credentialsHandover.owner_name} ! Votre boutique "${credentialsHandover.store_name}" sur GotoShop est validée et activée.\n\n` +
                    `Voici vos identifiants d'accès gérant :\n` +
                    `🔗 Espace Gérant : ${window.location.origin}/#admin\n` +
                    `📧 Email : ${credentialsHandover.owner_email}\n` +
                    `🔑 Mot de passe : ${credentialsHandover.generated_password}\n\n` +
                    `Lien public de votre vitrine : ${window.location.origin}/?store=${credentialsHandover.store_name
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, "-")}\n\n` +
                    `Bienvenue sur GotoShop !`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-950/50 transition-all"
              >
                <span>📲 Envoyer les Identifiants par WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => setCredentialsHandover(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rejet */}
      {rejectionModalReq && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-white text-base">Rejeter la Demande</h3>
                <p className="text-xs text-slate-400">Boutique : {rejectionModalReq.store_name}</p>
              </div>
              <button
                onClick={() => setRejectionModalReq(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Motif du rejet (transmis au commerçant) :
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReasonText}
                  onChange={(e) => setRejectionReasonText(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectionModalReq(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-950/40"
                >
                  Confirmer le Rejet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
