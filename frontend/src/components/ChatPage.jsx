import Icon from "./Icon";
import React, { useState, useEffect, useRef } from "react";
import {
  fetchConversations,
  fetchConversationDetail,
  fetchConversationMessages,
  sendChatMessage,
  uploadChatMedia,
  markConversationRead,
  getChatWebSocketUrl,
  acceptOrder,
  rejectOrder,
  submitPaymentProof,
  confirmOrderPayment,
  rejectOrderPayment,
  updateOrderStatus,
  startCallSession,
  answerCallSession,
  rejectCallSession,
  endCallSession,
  fetchCallHistory,
  getMediaUrl,
} from "../api/client";
import { formatSalesQuantity } from "../utils/salesEngine";
import MobileMoneyPaymentModal from "./MobileMoneyPaymentModal";

export default function ChatPage({
  store,
  customer,
  initialConversationId = null,
  appMode = "client", // "client" | "owner"
  onClose,
  showToast,
  onNavigateToOrder,
}) {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(initialConversationId);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConv, setLoadingConv] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Tab filter: "ALL" | "BOUTIQUE" | "ORDER" | "CALLS"
  const [filterTab, setFilterTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [callsHistory, setCallsHistory] = useState([]);

  // Desktop right sidebar open
  const [showRightDrawer, setShowRightDrawer] = useState(false);

  // Message input state
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  // Voice note recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // WebRTC Native Call state
  const [activeCall, setActiveCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callTimerRef = useRef(null);

  // Payment proof & Mobile Money modals
  const [previewMediaUrl, setPreviewMediaUrl] = useState(null);
  const [isPaymentProofModalOpen, setIsPaymentProofModalOpen] = useState(false);
  const [isMobileMoneyModalOpen, setIsMobileMoneyModalOpen] = useState(false);
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentFile, setPaymentFile] = useState(null);

  // WebSocket ref
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const isMerchant = appMode === "owner";
  const currentUserId = isMerchant
    ? store?.owner_id
    : customer?.id || customer?.session_token || localStorage.getItem("conversastore_guest_token") || "guest_user";
  const currentUserName = isMerchant ? store?.name || "Commerçant" : customer?.name || "Client";
  const currentUserType = isMerchant ? "MERCHANT" : "CUSTOMER";

  // 1. Load Conversations List
  const loadConversations = async () => {
    try {
      const params = {};
      if (isMerchant && store?.id) {
        params.store_id = store.id;
      } else {
        if (customer?.id) params.customer_id = customer.id;
        else if (customer?.session_token) params.customer_token = customer.session_token;
        else {
          const gToken = localStorage.getItem("conversastore_guest_token");
          if (gToken) params.customer_token = gToken;
        }
      }

      if (filterTab === "ORDER") params.context_filter = "ORDER";
      else if (filterTab === "BOUTIQUE") params.context_filter = "BOUTIQUE";
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const data = await fetchConversations(params);
      setConversations(data);

      if (!activeConvId && data.length > 0) {
        setActiveConvId(data[0].id);
      }
    } catch (e) {
      console.error("Error loading conversations", e);
    }
  };

  const loadCallsHistory = async () => {
    try {
      const data = await fetchCallHistory({
        store_id: store?.id,
        conversation_id: activeConvId || undefined,
      });
      setCallsHistory(data);
    } catch (e) {
      console.error("Error loading calls", e);
    }
  };

  useEffect(() => {
    loadConversations();
    if (filterTab === "CALLS") {
      loadCallsHistory();
    }
  }, [filterTab, store?.id, appMode]);

  // 2. Load Active Conversation & Messages
  useEffect(() => {
    if (!activeConvId) return;

    let isMounted = true;
    setLoadingMessages(true);

    const fetchDetails = async () => {
      try {
        const [conv, msgs] = await Promise.all([
          fetchConversationDetail(activeConvId),
          fetchConversationMessages(activeConvId, 100),
        ]);
        if (isMounted) {
          setActiveConv(conv);
          setMessages(msgs);
          setLoadingMessages(false);
          markConversationRead(activeConvId, currentUserType, currentUserId);
        }
      } catch (err) {
        if (isMounted) setLoadingMessages(false);
      }
    };

    fetchDetails();

    // 3. Connect Realtime WebSocket
    const wsUrl = getChatWebSocketUrl(activeConvId, {
      user_id: currentUserId,
      user_name: currentUserName,
      role: isMerchant ? "merchant" : "customer",
    });

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        // New Message Created
        if (payload.type === "message.created" && payload.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.message.id)) return prev;
            return [...prev, payload.message];
          });
        }

        // Typing Status
        else if (payload.type === "typing.status") {
          if (payload.user_id !== currentUserId) {
            setTypingUsers((prev) => {
              if (payload.is_typing) {
                return Array.from(new Set([...prev, payload.user_name]));
              } else {
                return prev.filter((u) => u !== payload.user_name);
              }
            });
          }
        }

        // Order Status Updated
        else if (payload.type === "order.status_updated") {
          setActiveConv((prev) => {
            if (!prev || !prev.order) return prev;
            return {
              ...prev,
              order: {
                ...prev.order,
                status: payload.status,
                payment_status: payload.payment_status || prev.order.payment_status,
              },
            };
          });
        }

        // Payment Proof Submitted
        else if (payload.type === "payment.proof_submitted") {
          setActiveConv((prev) => {
            if (!prev || !prev.order) return prev;
            return {
              ...prev,
              order: {
                ...prev.order,
                payment_status: payload.payment_status,
              },
            };
          });
        }

        // Incoming Call
        else if (payload.type === "call.incoming" && payload.call) {
          if (payload.call.caller_id !== currentUserId) {
            setActiveCall(payload.call);
          }
        }

        // Call Accepted
        else if (payload.type === "call.accepted") {
          if (activeCall) {
            setActiveCall((prev) => ({ ...prev, status: "ACCEPTED" }));
            startCallTimer();
          }
        }

        // Call Rejected / Ended
        else if (payload.type === "call.rejected" || payload.type === "call.ended") {
          handleCleanupCall();
        }

        // WebRTC Signaling Relay
        else if (payload.type === "webrtc.signal" && payload.signal) {
          handleIncomingWebRtcSignal(payload.signal);
        }
      } catch (e) {
        console.error("Error parsing WS frame", e);
      }
    };

    return () => {
      isMounted = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [activeConvId, appMode]);

  // Auto-scroll to bottom of message list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  // Typing indicator broadcast
  const handleTypingChange = (e) => {
    setInputText(e.target.value);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "typing",
          user_id: currentUserId,
          user_name: currentUserName,
          is_typing: Boolean(e.target.value.trim()),
        })
      );
    }
  };

  // 4. Send Message (Text)
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isSending || !activeConvId) return;

    const content = inputText.trim();
    setInputText("");
    setIsSending(true);

    try {
      const msg = await sendChatMessage(activeConvId, {
        sender_type: currentUserType,
        sender_name: currentUserName,
        sender_id: currentUserId,
        content: content,
        message_type: "TEXT",
      });

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      // Stop typing
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "typing.stopped",
            user_id: currentUserId,
            user_name: currentUserName,
            is_typing: false,
          })
        );
      }
    } catch (err) {
      showToast?.(err.message || "Erreur d'envoi");
    } finally {
      setIsSending(false);
    }
  };

  // 5. Send Location Message
  const handleSendLocation = () => {
    if (!navigator.geolocation) {
      showToast?.("Géolocalisation non supportée");
      return;
    }
    showToast?.("Récupération de votre position...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(5));
        const lng = parseFloat(pos.coords.longitude.toFixed(5));
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

        try {
          const msg = await sendChatMessage(activeConvId, {
            sender_type: currentUserType,
            sender_name: currentUserName,
            sender_id: currentUserId,
            content: `📍 Position partagée : ${lat}, ${lng}`,
            message_type: "LOCATION",
            metadata: {
              latitude: lat,
              longitude: lng,
              accuracy: pos.coords.accuracy,
              maps_url: mapsUrl,
              address: "Position GPS exacte (Ouagadougou / Kossodo)",
            },
          });
          setMessages((prev) => [...prev, msg]);
          showToast?.("Position envoyée dans le chat !");
        } catch (e) {
          showToast?.("Erreur envoi position");
        }
      },
      () => showToast?.("Impossible d'obtenir la position GPS")
    );
  };

  // 6. Voice Notes Recording (MediaRecorder API)
  const startRecordingAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        if (audioChunksRef.current.length > 0 && recordingSeconds > 0) {
          await sendRecordedAudio(audioBlob, recordingSeconds);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      showToast?.("Accès au microphone refusé ou non supporté");
    }
  };

  const stopRecordingAudio = () => {
    if (mediaRecorderRef.current && isRecording) {
      clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecordingAudio = () => {
    if (mediaRecorderRef.current && isRecording) {
      clearInterval(recordingTimerRef.current);
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingSeconds(0);
      showToast?.("Enregistrement annulé");
    }
  };

  const sendRecordedAudio = async (blob, durationSec) => {
    showToast?.("Envoi de la note vocale...");
    const formData = new FormData();
    const file = new File([blob], `voice_note_${Date.now()}.webm`, { type: "audio/webm" });
    formData.append("file", file);
    formData.append("sender_type", currentUserType);
    formData.append("sender_name", currentUserName);
    formData.append("sender_id", currentUserId);
    formData.append("duration_seconds", durationSec);

    try {
      const msg = await uploadChatMedia(activeConvId, formData);
      setMessages((prev) => [...prev, msg]);
      showToast?.("Note vocale envoyée !");
    } catch (e) {
      showToast?.("Erreur envoi audio");
    }
  };

  // 7. File & Image Attachment Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast?.("Téléversement du fichier...");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("sender_type", currentUserType);
    formData.append("sender_name", currentUserName);
    formData.append("sender_id", currentUserId);

    try {
      const msg = await uploadChatMedia(activeConvId, formData);
      setMessages((prev) => [...prev, msg]);
      showToast?.("Média envoyé avec succès !");
    } catch (err) {
      showToast?.(err.message || "Erreur upload");
    }
  };

  // 8. Order Actions (Accept / Reject)
  const handleAcceptOrder = async (orderId) => {
    try {
      await acceptOrder(orderId, currentUserName);
      showToast?.("Commande acceptée avec succès !");
      const updated = await fetchConversationDetail(activeConvId);
      setActiveConv(updated);
    } catch (err) {
      showToast?.(err.message || "Erreur acceptation");
    }
  };

  const handleRejectOrder = async (orderId) => {
    const reason = prompt("Précisez le motif du refus (optionnel) :", "Rupture de stock");
    if (reason === null) return;
    try {
      await rejectOrder(orderId, reason, currentUserName);
      showToast?.("Commande refusée");
      const updated = await fetchConversationDetail(activeConvId);
      setActiveConv(updated);
    } catch (err) {
      showToast?.(err.message || "Erreur refus");
    }
  };

  // 9. Payment Confirmation & Proof Workflow
  const handleOpenPaymentProofModal = () => {
    setIsPaymentProofModalOpen(true);
  };

  const handleSubmitProof = async () => {
    if (!paymentFile) {
      showToast?.("Veuillez sélectionner une image de capture ou photo du reçu");
      return;
    }

    const orderId = activeConv?.order?.id;
    if (!orderId) return;

    showToast?.("Envoi de la capture de paiement...");
    const formData = new FormData();
    formData.append("file", paymentFile);
    formData.append("customer_note", paymentNote || "Capture de transfert Orange Money / Wave");
    formData.append("sender_id", currentUserId);
    formData.append("sender_name", currentUserName);

    try {
      const res = await uploadChatMedia(activeConvId, formData);
      // Also submit as explicit payment proof
      await submitPaymentProof(orderId, {
        file_url: res.attachments?.[0]?.file_url || "/media/uploads/proof.jpg",
        file_name: paymentFile.name,
        file_size: paymentFile.size,
        mime_type: paymentFile.type || "image/jpeg",
        customer_note: paymentNote,
        sender_id: currentUserId,
        sender_name: currentUserName,
      });

      setIsPaymentProofModalOpen(false);
      setPaymentFile(null);
      setPaymentNote("");
      showToast?.("Preuve de paiement transmise au commerçant !");
      const updated = await fetchConversationDetail(activeConvId);
      setActiveConv(updated);
    } catch (err) {
      showToast?.(err.message || "Erreur soumission preuve");
    }
  };

  const handleConfirmPayment = async (orderId) => {
    try {
      await confirmOrderPayment(orderId, currentUserName);
      showToast?.("Paiement validé ! La commande passe en préparation.");
      const updated = await fetchConversationDetail(activeConvId);
      setActiveConv(updated);
    } catch (err) {
      showToast?.(err.message || "Erreur validation paiement");
    }
  };

  const handleRejectPayment = async (orderId) => {
    const reason = prompt("Indiquez la raison du problème :", "Montant incorrect ou illisible");
    if (reason === null) return;
    try {
      await rejectOrderPayment(orderId, reason, currentUserName);
      showToast?.("Problème de paiement signalé au client");
      const updated = await fetchConversationDetail(activeConvId);
      setActiveConv(updated);
    } catch (err) {
      showToast?.(err.message || "Erreur rejet");
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus, null, currentUserName);
      showToast?.(`Statut mis à jour : ${newStatus}`);
      const updated = await fetchConversationDetail(activeConvId);
      setActiveConv(updated);
    } catch (err) {
      showToast?.(err.message || "Erreur mise à jour statut");
    }
  };

  // 10. Native WebRTC Audio & Video Calls
  const handleStartCall = async (callType = "AUDIO") => {
    try {
      showToast?.(`Démarrage de l'appel ${callType === "AUDIO" ? "vocal" : "vidéo"}...`);
      const call = await startCallSession({
        conversation_id: activeConvId,
        caller_type: currentUserType,
        caller_name: currentUserName,
        call_type: callType,
        caller_id: currentUserId,
      });

      setActiveCall(call);

      // Acquire local media stream
      const constraints = {
        audio: true,
        video: callType === "VIDEO" ? { width: 640, height: 480 } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current && callType === "VIDEO") {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize WebRTC PeerConnection
      initWebRtcPeerConnection(stream, true);
    } catch (err) {
      showToast?.(err.message || "Impossible de démarrer l'appel");
      handleCleanupCall();
    }
  };

  const handleAnswerCall = async () => {
    if (!activeCall) return;
    try {
      await answerCallSession(activeCall.id);
      setActiveCall((prev) => ({ ...prev, status: "ACCEPTED" }));

      // Acquire media stream
      const constraints = {
        audio: true,
        video: activeCall.call_type === "VIDEO" ? { width: 640, height: 480 } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current && activeCall.call_type === "VIDEO") {
        localVideoRef.current.srcObject = stream;
      }

      initWebRtcPeerConnection(stream, false);
      startCallTimer();
    } catch (err) {
      showToast?.("Erreur acceptation appel");
    }
  };

  const handleRejectCall = async () => {
    if (!activeCall) return;
    try {
      await rejectCallSession(activeCall.id, "DECLINED");
    } catch (e) {}
    handleCleanupCall();
  };

  const handleEndCall = async () => {
    if (!activeCall) return;
    try {
      await endCallSession(activeCall.id);
    } catch (e) {}
    handleCleanupCall();
    showToast?.("Appel terminé");
  };

  const initWebRtcPeerConnection = (localStream, isInitiator) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerConnectionRef.current = pc;

      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      pc.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "webrtc.signal",
              signal: { candidate: event.candidate },
            })
          );
        }
      };

      if (isInitiator) {
        pc.createOffer().then((offer) => {
          pc.setLocalDescription(offer);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "webrtc.signal",
                signal: { sdp: offer },
              })
            );
          }
        });
      }
    } catch (e) {
      console.error("WebRTC Init error", e);
    }
  };

  const handleIncomingWebRtcSignal = async (signal) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      if (signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "webrtc.signal",
                signal: { sdp: answer },
              })
            );
          }
        }
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (e) {
      console.error("Signal handling error", e);
    }
  };

  const startCallTimer = () => {
    setCallDuration(0);
    clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
  };

  const handleCleanupCall = () => {
    clearInterval(callTimerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setActiveCall(null);
    setCallDuration(0);
    setIsMicMuted(false);
    setIsCameraOff(false);
  };

  const formatTimer = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-background text-foreground antialiased overflow-hidden animate-fadeIn">
      
      {/* ==================================================================== */}
      {/* COLUMN 1 : CONVERSATIONS & CALLS LIST (Desktop 320px / Mobile Full) */}
      {/* ==================================================================== */}
      <div
        className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-border bg-surface shrink-0 ${
          activeConvId ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Top Header */}
        <div className="p-4 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Icon name="forum" className="text-xl" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Messagerie</h2>
              <p className="text-[11px] text-foreground-muted">
                {isMerchant ? "Espace Commerçant • Commandes & Clients" : "Discussions & Commandes"}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-foreground-muted hover:bg-surface-elevated hover:text-foreground"
            >
              <Icon name="close" className="text-xl" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="p-3 border-b border-border flex items-center gap-1.5 overflow-x-auto">
          {[
            { key: "ALL", label: "Toutes" },
            { key: "ORDER", label: "Commandes" },
            { key: "BOUTIQUE", label: "Boutiques" },
            { key: "CALLS", label: "Appels" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterTab === tab.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface-elevated text-foreground-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="px-3 pt-2.5 pb-1">
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-2.5 text-foreground-muted text-sm" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher conversation, commande..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-surface-elevated border border-border focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Conversation List / Calls History */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
          {filterTab === "CALLS" ? (
            callsHistory.length === 0 ? (
              <div className="p-8 text-center text-xs text-foreground-muted">
                Aucun appel récent
              </div>
            ) : (
              callsHistory.map((call) => (
                <div key={call.id} className="p-3.5 hover:bg-surface-elevated/50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        call.status === "ENDED" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      <Icon name={call.call_type === "VIDEO" ? "videocam" : "call"} className="text-lg" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs truncate">
                        {isMerchant ? call.caller_name : call.callee_name}
                      </div>
                      <div className="text-[11px] text-foreground-muted flex items-center gap-1.5">
                        <span>{call.duration_formatted}</span>
                        <span>•</span>
                        <span className="capitalize">{call.call_type.toLowerCase()}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (call.conversation_id) {
                        setActiveConvId(call.conversation_id);
                        setFilterTab("ALL");
                      }
                    }}
                    className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Icon name="chat" className="text-sm" />
                  </button>
                </div>
              ))
            )
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-foreground-muted">
              Aucune conversation trouvée
            </div>
          ) : (
            conversations.map((c) => {
              const isSelected = c.id === activeConvId;
              return (
                <div
                  key={c.id}
                  onClick={() => setActiveConvId(c.id)}
                  className={`p-3.5 cursor-pointer transition-colors flex items-center gap-3 ${
                    isSelected ? "bg-primary/10 border-l-4 border-primary" : "hover:bg-surface-elevated/40"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-surface-elevated border border-border flex items-center justify-center font-bold text-sm text-primary overflow-hidden">
                      {c.store_logo_url || c.store_avatar_url ? (
                        <img
                          src={getMediaUrl(c.store_logo_url || c.store_avatar_url)}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = "none";
                            if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <span className={`w-full h-full flex items-center justify-center ${c.store_logo_url || c.store_avatar_url ? "hidden" : "flex"}`}>
                        {c.store_name?.charAt(0) || "B"}
                      </span>
                    </div>
                    {c.unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center border-2 border-surface">
                        {c.unread_count}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className="font-bold text-xs truncate text-foreground">
                        {c.title || c.store_name}
                      </h4>
                      {c.order_number && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold shrink-0">
                          #{c.order_number}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-foreground-muted truncate">
                      {c.last_message_preview || "Nouvel échange"}
                    </p>

                    {c.order_status && (
                      <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded font-medium ${
                            c.order_status === "PAID" || c.order_status === "COMPLETED"
                              ? "bg-emerald-500/15 text-emerald-500"
                              : c.order_status === "REJECTED"
                              ? "bg-red-500/15 text-red-500"
                              : "bg-amber-500/15 text-amber-500"
                          }`}
                        >
                          {c.order_status}
                        </span>
                        {c.order_total && (
                          <span className="text-foreground-muted font-bold">
                            {c.order_total.toLocaleString()} F
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* COLUMN 2 : ACTIVE CHAT ROOM (Mobile Full / Desktop Main) */}
      {/* ==================================================================== */}
      <div
        className={`flex-1 flex flex-col h-full bg-background min-w-0 ${
          !activeConvId ? "hidden md:flex" : "flex"
        }`}
      >
        {activeConv ? (
          <>
            {/* Top Room Header */}
            <div className="px-4 py-3 border-b border-border bg-surface flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Back button on mobile */}
                <button
                  onClick={() => setActiveConvId(null)}
                  className="md:hidden w-8 h-8 rounded-full flex items-center justify-center text-foreground-muted hover:bg-surface-elevated"
                >
                  <Icon name="arrow_back" className="text-xl" />
                </button>

                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-surface-elevated border border-border flex items-center justify-center font-bold text-sm text-primary overflow-hidden">
                    {activeConv.store?.logo_url || activeConv.store?.avatar_url ? (
                      <img
                        src={getMediaUrl(activeConv.store.logo_url || activeConv.store.avatar_url)}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = "none";
                          if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <span className={`w-full h-full flex items-center justify-center ${activeConv.store?.logo_url || activeConv.store?.avatar_url ? "hidden" : "flex"}`}>
                      {activeConv.store?.name?.charAt(0) || "B"}
                    </span>
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-surface" />
                </div>

                <div className="min-w-0">
                  <h3 className="font-bold text-sm truncate flex items-center gap-1.5">
                    <span>{activeConv.store?.name || "Boutique"}</span>
                    <span className="text-[10px] text-emerald-500 font-medium">● En ligne</span>
                  </h3>
                  <p className="text-[11px] text-foreground-muted truncate">
                    {activeConv.context_type === "ORDER" && activeConv.order
                      ? `Commande #${activeConv.order.order_number} • ${activeConv.order.total_amount?.toLocaleString()} ${activeConv.order.currency}`
                      : "Discussion directe commerçant"}
                  </p>
                </div>
              </div>

              {/* Call & Info buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleStartCall("AUDIO")}
                  className="p-2 rounded-xl text-foreground-muted hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Appel vocal"
                >
                  <Icon name="call" className="text-xl" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStartCall("VIDEO")}
                  className="p-2 rounded-xl text-foreground-muted hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Appel vidéo"
                >
                  <Icon name="videocam" className="text-xl" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowRightDrawer(!showRightDrawer)}
                  className={`p-2 rounded-xl transition-colors ${
                    showRightDrawer ? "bg-primary text-white" : "text-foreground-muted hover:bg-surface-elevated"
                  }`}
                  title="Informations"
                >
                  <Icon name="info" className="text-xl" />
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="md:hidden w-8 h-8 rounded-full flex items-center justify-center text-foreground-muted hover:bg-surface-elevated"
                  >
                    <Icon name="close" className="text-xl" />
                  </button>
                )}
              </div>
            </div>

            {/* Contextual Order Header Banner (Bidirectional link) */}
            {activeConv.order && (
              <div className="px-4 py-2.5 bg-primary/10 border-b border-primary/20 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name="receipt_long" className="text-primary text-base shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-foreground">
                      Commande #{activeConv.order.order_number}
                    </span>
                    <span className="text-foreground-muted mx-1.5">•</span>
                    <span className="font-semibold text-primary">
                      {activeConv.order.total_amount?.toLocaleString()} {activeConv.order.currency}
                    </span>
                    <span className="text-foreground-muted mx-1.5">•</span>
                    <span className="text-foreground-muted">
                      {activeConv.order.status}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToOrder) onNavigateToOrder(activeConv.order.id);
                    else setShowRightDrawer(true);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-surface border border-primary/30 text-primary hover:bg-primary hover:text-white transition-all shrink-0"
                >
                  Voir les détails
                </button>
              </div>
            )}

            {/* Interactive Order Action Banners for Current State */}
            {activeConv.order && (
              <div className="px-4 py-2.5 bg-surface-elevated/60 border-b border-border flex flex-col gap-2 text-xs">
                {/* 1. Merchant: Order Pending Acceptance with GPS & 1-Click Accept */}
                {isMerchant && activeConv.order.status === "PENDING_SELLER_ACCEPTANCE" && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 w-full">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500 font-bold flex items-center gap-1">
                          <Icon name="hourglass_top" className="text-[16px] animate-pulse" />
                          Nouvelle commande à valider : #{activeConv.order.order_number}
                        </span>
                        <span className="font-bold text-primary">
                          ({activeConv.order.total_amount?.toLocaleString()} {activeConv.order.currency})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-foreground-muted flex-wrap">
                        <span>📍 {activeConv.order.delivery_city || "Ouagadougou"} {activeConv.order.delivery_neighborhood || activeConv.order.delivery?.delivery_address ? `(${activeConv.order.delivery_neighborhood || activeConv.order.delivery?.delivery_address})` : ""}</span>
                        {(activeConv.order.customer_location_url || activeConv.order.delivery?.maps_url) && (
                          <a
                            href={activeConv.order.customer_location_url || activeConv.order.delivery?.maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-secondary hover:underline font-bold inline-flex items-center gap-0.5"
                          >
                            <Icon name="pin_drop" className="text-[13px]" />
                            <span>GPS Maps</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <button
                        onClick={() => handleRejectOrder(activeConv.order.id)}
                        className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-red-500 border border-red-500/30 hover:bg-red-500/10 font-bold text-xs transition-colors cursor-pointer"
                      >
                        Refuser
                      </button>
                      <button
                        onClick={() => handleAcceptOrder(activeConv.order.id)}
                        className="flex-1 sm:flex-initial px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Icon name="check" className="text-[16px]" />
                        <span>Accepter la commande (1 clic)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Customer: Order Accepted, Mobile Money Payment Call-to-Action */}
                {!isMerchant && (activeConv.order.status === "ACCEPTED" || activeConv.order.payment_status === "PAYMENT_PENDING") && activeConv.order.payment_status !== "PAYMENT_CONFIRMED" && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 w-full bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/30">
                    <div className="space-y-0.5">
                      <p className="text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                        <Icon name="verified" className="text-[16px] text-emerald-500" />
                        <span>Commande acceptée par le vendeur !</span>
                      </p>
                      <p className="text-[11px] text-foreground-muted">
                        ⚡ Soldez votre commande via Mobile Money pour déclencher la <strong>livraison express garantie (45 min à 2h)</strong>.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsMobileMoneyModalOpen(true)}
                        className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:brightness-105 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <Icon name="payments" className="text-[16px]" />
                        <span>Payer par Mobile Money (Orange / Moov)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenPaymentProofModal}
                        className="px-2.5 py-2 rounded-xl bg-surface-elevated hover:bg-surface text-foreground-muted hover:text-foreground text-[11px] font-semibold border border-subtle transition-colors cursor-pointer"
                        title="Envoyer un reçu ou capture de virement"
                      >
                        <Icon name="receipt" className="text-[16px]" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 2b. Customer: Order Paid Notification */}
                {!isMerchant && (activeConv.order.status === "PAID" || activeConv.order.payment_status === "PAYMENT_CONFIRMED") && (
                  <div className="flex items-center justify-between w-full bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/30 text-xs text-blue-700 dark:text-blue-300">
                    <div className="flex items-center gap-2">
                      <Icon name="electric_moped" className="text-[18px] text-blue-500" />
                      <span><strong>Commande Soldée ✓</strong> • Préparation en cours, livraison express sous 45 min à 2h.</span>
                    </div>
                    <span className="font-mono text-[10px] bg-blue-500/20 px-2 py-0.5 rounded-full font-bold">
                      {activeConv.order.transaction_reference || "LigdiCash"}
                    </span>
                  </div>
                )}

                {/* 3. Merchant: Payment Proof Submitted, Awaiting Confirmation */}
                {isMerchant && activeConv.order.payment_status === "PAYMENT_PROOF_SUBMITTED" && (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-primary font-bold">Preuve de paiement reçue du client !</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRejectPayment(activeConv.order.id)}
                        className="px-3 py-1 rounded-lg text-red-500 border border-red-500/30 hover:bg-red-500/10 font-bold text-xs"
                      >
                        Signaler problème
                      </button>
                      <button
                        onClick={() => handleConfirmPayment(activeConv.order.id)}
                        className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700"
                      >
                        Confirmer le paiement
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. Merchant: Progression Stepper */}
                {isMerchant && activeConv.order.payment_status === "PAYMENT_CONFIRMED" && (
                  <div className="flex items-center gap-2 w-full justify-between">
                    <span className="text-emerald-500 font-bold">Paiement validé ✓</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleUpdateStatus(activeConv.order.id, "PREPARING")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          activeConv.order.status === "PREPARING"
                            ? "bg-primary text-white border-primary"
                            : "bg-surface text-foreground-muted border-border"
                        }`}
                      >
                        Préparation
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(activeConv.order.id, "OUT_FOR_DELIVERY")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          activeConv.order.status === "OUT_FOR_DELIVERY"
                            ? "bg-primary text-white border-primary"
                            : "bg-surface text-foreground-muted border-border"
                        }`}
                      >
                        En livraison
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(activeConv.order.id, "COMPLETED")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          activeConv.order.status === "COMPLETED"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-surface text-foreground-muted border-border"
                        }`}
                      >
                        Livré ✓
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Messages Scroll View */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="py-12 text-center text-xs text-foreground-muted space-y-2">
                  <div className="w-12 h-12 rounded-full bg-surface-elevated mx-auto flex items-center justify-center text-primary">
                    <Icon name="chat" className="text-2xl" />
                  </div>
                  <p>Démarrez la conversation avec {activeConv.store?.name}.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMine = m.sender_type === currentUserType;

                  // 1. SYSTEM MESSAGE
                  if (m.message_type === "SYSTEM") {
                    return (
                      <div key={m.id} className="flex justify-center my-3">
                        <div className="px-3.5 py-1.5 rounded-full bg-surface-elevated/90 border border-border text-[11px] text-foreground-muted shadow-sm max-w-md text-center">
                          {m.content}
                        </div>
                      </div>
                    );
                  }

                  // 2. ORDER CARD MESSAGE
                  if (m.message_type === "ORDER") {
                    const meta = m.metadata || {};
                    return (
                      <div key={m.id} className="flex justify-center my-3">
                        <div className="w-full max-w-sm p-4 bg-surface rounded-2xl border border-primary/30 shadow-lg space-y-3">
                          <div className="flex items-center justify-between border-b border-border pb-2">
                            <span className="font-bold text-xs text-primary">
                              COMMANDE #{meta.order_number || activeConv.order?.order_number}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                              {meta.status || activeConv.order?.status || "Créée"}
                            </span>
                          </div>

                          <div className="text-xs space-y-1">
                            <p className="font-semibold text-foreground">
                              {meta.items_summary || "Articles commandés"}
                            </p>
                            <p className="text-primary font-bold text-sm">
                              Total : {meta.total_amount?.toLocaleString() || activeConv.order?.total_amount?.toLocaleString()} {meta.currency || "FCFA"}
                            </p>
                            {meta.delivery_address && (
                              <p className="text-[11px] text-foreground-muted">
                                📍 {meta.delivery_address}
                              </p>
                            )}
                          </div>

                          {/* Quick action buttons if viewer is merchant and pending */}
                          {isMerchant && activeConv.order?.status === "PENDING_SELLER_ACCEPTANCE" && (
                            <div className="pt-2 border-t border-border flex items-center gap-2">
                              <button
                                onClick={() => handleRejectOrder(meta.order_id || activeConv.order?.id)}
                                className="flex-1 py-1.5 text-xs font-bold rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10"
                              >
                                Refuser
                              </button>
                              <button
                                onClick={() => handleAcceptOrder(meta.order_id || activeConv.order?.id)}
                                className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary-hover shadow"
                              >
                                Accepter
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // 3. PAYMENT PROOF MESSAGE
                  if (m.message_type === "PAYMENT_PROOF") {
                    const meta = m.metadata || {};
                    const proofImg = meta.file_url || m.attachments?.[0]?.file_url;
                    return (
                      <div key={m.id} className="flex justify-center my-3">
                        <div className="w-full max-w-sm p-4 bg-surface rounded-2xl border border-border shadow-lg space-y-3">
                          <div className="flex items-center justify-between border-b border-border pb-2">
                            <span className="font-bold text-xs text-primary flex items-center gap-1.5">
                              <Icon name="receipt" className="text-sm" />
                              Preuve de paiement reçue
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-bold">
                              {meta.status || "Vérification requise"}
                            </span>
                          </div>

                          {proofImg && (
                            <div
                              onClick={() => setPreviewMediaUrl(getMediaUrl(proofImg))}
                              className="relative cursor-pointer group rounded-xl overflow-hidden border border-border bg-black/20 aspect-video flex items-center justify-center"
                            >
                              <img
                                src={getMediaUrl(proofImg)}
                                alt="Capture de paiement"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                                Cliquer pour agrandir
                              </div>
                            </div>
                          )}

                          <div className="text-xs space-y-1">
                            <p className="font-medium text-foreground">{meta.file_name || "capture_paiement.jpg"}</p>
                            {meta.customer_note && (
                              <p className="text-[11px] text-foreground-muted italic">"{meta.customer_note}"</p>
                            )}
                          </div>

                          {/* Seller buttons */}
                          {isMerchant && activeConv.order?.payment_status === "PAYMENT_PROOF_SUBMITTED" && (
                            <div className="pt-2 border-t border-border flex items-center gap-2">
                              <button
                                onClick={() => handleRejectPayment(meta.order_id || activeConv.order?.id)}
                                className="flex-1 py-1.5 text-xs font-bold rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10"
                              >
                                Signaler
                              </button>
                              <button
                                onClick={() => handleConfirmPayment(meta.order_id || activeConv.order?.id)}
                                className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow"
                              >
                                Confirmer paiement
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // 4. CALL EVENT MESSAGE
                  if (m.message_type === "CALL_EVENT") {
                    return (
                      <div key={m.id} className="flex justify-center my-2">
                        <div className="px-3 py-1.5 rounded-xl bg-surface-elevated/60 border border-border text-[11px] text-foreground-muted flex items-center gap-2">
                          <Icon name="phone_in_talk" className="text-sm text-primary" />
                          <span>{m.content}</span>
                        </div>
                      </div>
                    );
                  }

                  // 5. STANDARD HUMAN CHAT MESSAGE (Text, Voice Note, Image, Location)
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-md p-3.5 rounded-2xl text-xs space-y-1.5 shadow-sm ${
                          isMine
                            ? "bg-primary text-white rounded-br-none"
                            : "bg-surface border border-border text-foreground rounded-bl-none"
                        }`}
                      >
                        {/* Sender header in group chats */}
                        {!isMine && (
                          <div className="font-bold text-[10px] text-primary mb-1">
                            {m.sender_name}
                          </div>
                        )}

                        {/* Location card */}
                        {m.message_type === "LOCATION" && m.metadata?.latitude && (
                          <div className="p-2 rounded-xl bg-black/10 border border-white/10 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold">
                              <Icon name="location_on" className="text-sm" />
                              <span>Localisation partagée</span>
                            </div>
                            <p className="text-[11px] opacity-90">{m.metadata.address}</p>
                            <a
                              href={m.metadata.maps_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block mt-1 text-[10px] underline font-bold"
                            >
                              Ouvrir sur Google Maps
                            </a>
                          </div>
                        )}

                        {/* Audio Voice Note Player */}
                        {m.message_type === "AUDIO" && m.attachments?.[0]?.file_url && (
                          <div className="p-2 rounded-xl bg-black/10 flex items-center gap-3 min-w-[200px]">
                            <button
                              type="button"
                              onClick={(e) => {
                                const audioEl = e.currentTarget.parentElement.querySelector("audio");
                                if (audioEl) {
                                  if (audioEl.paused) audioEl.play();
                                  else audioEl.pause();
                                }
                              }}
                              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
                            >
                              <Icon name="play_arrow" className="text-base" />
                            </button>
                            <audio src={getMediaUrl(m.attachments[0].file_url)} className="hidden" />
                            <div className="flex-1">
                              <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
                                <div className="h-full bg-white w-1/3" />
                              </div>
                              <span className="text-[10px] opacity-80 mt-1 block">
                                {m.attachments[0].duration_seconds
                                  ? `${Math.round(m.attachments[0].duration_seconds)}s`
                                  : "Note vocale"}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Image attachment preview */}
                        {m.message_type === "IMAGE" && m.attachments?.[0]?.file_url && (
                          <div
                            onClick={() => setPreviewMediaUrl(getMediaUrl(m.attachments[0].file_url))}
                            className="cursor-pointer rounded-xl overflow-hidden border border-white/20 my-1 max-h-60"
                          >
                            <img
                              src={getMediaUrl(m.attachments[0].file_url)}
                              alt="Image"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Text Content */}
                        {m.content && <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>}

                        {/* Timestamp */}
                        <div
                          className={`text-[9px] text-right mt-1 opacity-70 ${
                            isMine ? "text-white" : "text-foreground-muted"
                          }`}
                        >
                          {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-foreground-muted italic animate-pulse">
                  <Icon name="edit" className="text-sm" />
                  <span>{typingUsers.join(", ")} est en train d'écrire...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Action / Input Bar */}
            <div className="p-3 border-t border-border bg-surface shrink-0">
              {/* Client gating: Chat is locked until order is accepted by merchant */}
              {!isMerchant && (!activeConv.order || activeConv.order.status === "PENDING_SELLER_ACCEPTANCE") ? (
                <div className="p-3.5 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-300">
                    <Icon
                      name={activeConv.order ? "hourglass_top" : "lock"}
                      className={`text-[20px] text-amber-500 shrink-0 ${activeConv.order ? "animate-pulse" : ""}`}
                    />
                    <span className="font-medium leading-relaxed">
                      {activeConv.order
                        ? `Votre commande #${activeConv.order.order_number} est en attente d'acceptation par le commerçant. La messagerie sera débloquée dès son acceptation en 1 clic.`
                        : "Les discussions directes nécessitent une commande acceptée par le vendeur. GotoShop ne permet pas de causerie gratuite sans commande."}
                    </span>
                  </div>
                  {activeConv.order ? (
                    <button
                      type="button"
                      onClick={() => onNavigateToOrder?.(activeConv.order.id)}
                      className="px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface border border-amber-500/40 text-on-surface font-bold text-xs shrink-0 cursor-pointer transition-colors"
                    >
                      Suivre ma commande
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onClose?.()}
                      className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs shrink-0 cursor-pointer shadow-sm transition-all"
                    >
                      Voir le catalogue
                    </button>
                  )}
                </div>
              ) : isRecording ? (
                /* Active Recording Bar */
                <div className="flex items-center justify-between gap-3 p-2 bg-red-500/10 border border-red-500/30 rounded-2xl">
                  <div className="flex items-center gap-2 text-red-500 font-bold text-xs">
                    <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                    <span>Enregistrement en cours... {formatTimer(recordingSeconds)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelRecordingAudio}
                      className="p-2 rounded-xl text-foreground-muted hover:text-red-500 hover:bg-surface"
                      title="Annuler"
                    >
                      <Icon name="delete" className="text-lg" />
                    </button>
                    <button
                      type="button"
                      onClick={stopRecordingAudio}
                      className="px-3.5 py-1.5 rounded-xl bg-red-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm"
                    >
                      <Icon name="send" className="text-sm" />
                      <span>Envoyer</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Regular Chat Input Bar */
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*,application/pdf"
                  />

                  {/* Attachment Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-colors"
                    title="Joindre une photo ou document"
                  >
                    <Icon name="attach_file" className="text-xl" />
                  </button>

                  {/* Location Button */}
                  <button
                    type="button"
                    onClick={handleSendLocation}
                    className="p-2 rounded-xl text-foreground-muted hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Partager ma position GPS"
                  >
                    <Icon name="location_on" className="text-xl" />
                  </button>

                  {/* Input field */}
                  <input
                    type="text"
                    value={inputText}
                    onChange={handleTypingChange}
                    placeholder="Écrivez votre message..."
                    className="flex-1 py-2 px-3.5 text-xs rounded-xl bg-surface-elevated border border-border focus:border-primary focus:outline-none transition-colors"
                  />

                  {/* Audio note or Send Button */}
                  {inputText.trim() ? (
                    <button
                      type="submit"
                      disabled={isSending}
                      className="p-2.5 rounded-xl bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all"
                    >
                      <Icon name="send" className="text-lg" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startRecordingAudio}
                      className="p-2.5 rounded-xl bg-surface-elevated text-primary hover:bg-primary/10 border border-primary/20 transition-all"
                      title="Maintenir ou cliquer pour enregistrer une note vocale"
                    >
                      <Icon name="mic" className="text-lg" />
                    </button>
                  )}
                </form>
              )}
            </div>
          </>
        ) : (
          /* Empty Active Room */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-foreground-muted">
            <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center text-primary mb-3">
              <Icon name="chat" className="text-3xl" />
            </div>
            <h3 className="font-bold text-base text-foreground">Espace de Commerce Conversationnel</h3>
            <p className="text-xs max-w-sm mt-1">
              Sélectionnez une conversation pour échanger avec la boutique ou suivre une commande en direct.
            </p>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* COLUMN 3 : CONTEXT DRAWER (Desktop Details Sidebar / Order & Store) */}
      {/* ==================================================================== */}
      {showRightDrawer && activeConv && (
        <div className="w-80 lg:w-96 border-l border-border bg-surface flex flex-col h-full shrink-0 animate-fadeIn">
          <div className="p-4 border-b border-border flex items-center justify-between bg-surface-elevated/40">
            <h3 className="font-bold text-sm">Informations</h3>
            <button
              onClick={() => setShowRightDrawer(false)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-muted hover:bg-surface-elevated"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
            {/* Store Card */}
            <div className="p-3.5 bg-surface-elevated/50 rounded-xl border border-border space-y-2 text-center">
              <div className="w-14 h-14 rounded-full bg-surface border border-border mx-auto flex items-center justify-center text-primary font-bold overflow-hidden">
                {activeConv.store?.logo_url || activeConv.store?.avatar_url ? (
                  <img
                    src={getMediaUrl(activeConv.store.logo_url || activeConv.store.avatar_url)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = "none";
                      if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <span className={`w-full h-full flex items-center justify-center ${activeConv.store?.logo_url || activeConv.store?.avatar_url ? "hidden" : "flex"}`}>
                  {activeConv.store?.name?.charAt(0) || "B"}
                </span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-foreground">{activeConv.store?.name}</h4>
                <p className="text-[11px] text-foreground-muted">{activeConv.store?.tagline}</p>
              </div>
              <div className="pt-2 border-t border-border flex justify-around text-foreground-muted">
                <span>⭐ {activeConv.store?.rating || "4.9"} / 5</span>
                <span>•</span>
                <span>Cité Kossodo</span>
              </div>
            </div>

            {/* Order Details (if any) */}
            {activeConv.order && (
              <div className="space-y-3">
                <div className="flex items-center justify-between font-bold text-xs text-foreground">
                  <span>Détail Commande</span>
                  <span className="text-primary font-mono">#{activeConv.order.order_number}</span>
                </div>

                <div className="p-3 bg-surface-elevated/50 rounded-xl border border-border space-y-2">
                  <div className="flex justify-between font-semibold">
                    <span>Statut :</span>
                    <span className="text-primary">{activeConv.order.status}</span>
                  </div>
                  <div className="flex justify-between text-foreground-muted">
                    <span>Paiement :</span>
                    <span>{activeConv.order.payment_status}</span>
                  </div>

                  {/* Items */}
                  <div className="border-t border-border pt-2 space-y-1">
                    {activeConv.order.items?.map((it) => (
                      <div key={it.id} className="space-y-0.5">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="font-medium text-foreground truncate">
                            {it.product_name} • {formatSalesQuantity(it.quantity, it.unit_label)}
                          </span>
                          <span className="font-semibold text-primary whitespace-nowrap">{it.total_price?.toLocaleString()} F</span>
                        </div>
                        {it.customization_text && (
                          <p className="text-[10px] text-primary italic pl-2 border-l border-primary">
                            "{it.customization_text}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Delivery Location */}
                  {activeConv.order.delivery && (
                    <div className="border-t border-border pt-2 space-y-1 text-foreground-muted">
                      <div className="font-semibold text-foreground flex items-center gap-1">
                        <Icon name="pin_drop" className="text-xs text-primary" />
                        <span>Livraison</span>
                      </div>
                      <p className="text-[11px]">{activeConv.order.delivery.delivery_address}</p>
                      {activeConv.order.delivery.maps_url && (
                        <a
                          href={activeConv.order.delivery.maps_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-primary font-bold underline block"
                        >
                          📍 Ouvrir position GPS
                        </a>
                      )}
                    </div>
                  )}

                  <div className="border-t border-border pt-2 flex justify-between font-bold text-sm text-primary">
                    <span>Total Net :</span>
                    <span>{activeConv.order.total_amount?.toLocaleString()} {activeConv.order.currency}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* NATIVE WEBRTC CALL OVERLAY MODAL */}
      {/* ==================================================================== */}
      {activeCall && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl p-6 flex flex-col items-center text-center space-y-6">
            
            {/* Ringing vs Active State Header */}
            <div>
              <div className="w-20 h-20 rounded-full bg-primary/20 text-primary mx-auto flex items-center justify-center mb-3 animate-pulse">
                <Icon name={activeCall.call_type === "VIDEO" ? "videocam" : "call"} className="text-4xl" />
              </div>
              <h3 className="font-bold text-lg text-foreground">
                {activeCall.caller_name}
              </h3>
              <p className="text-xs text-foreground-muted mt-1">
                {activeCall.status === "RINGING"
                  ? "Appel entrant..."
                  : `En cours (${formatTimer(callDuration)})`}
              </p>
            </div>

            {/* Video Streams (If Video Call) */}
            {activeCall.call_type === "VIDEO" && (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-border">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-2 right-2 w-24 aspect-video rounded-lg overflow-hidden border border-white/20 bg-black">
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            {/* Controls Bar */}
            {activeCall.status === "RINGING" ? (
              <div className="flex items-center justify-center gap-6 w-full pt-4">
                <button
                  onClick={handleRejectCall}
                  className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-transform active:scale-95"
                  title="Refuser"
                >
                  <Icon name="call_end" className="text-2xl" />
                </button>
                <button
                  onClick={handleAnswerCall}
                  className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-transform active:scale-95 animate-bounce"
                  title="Accepter"
                >
                  <Icon name="call" className="text-2xl" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4 w-full pt-2">
                <button
                  onClick={() => setIsMicMuted(!isMicMuted)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    isMicMuted ? "bg-red-500/20 text-red-500" : "bg-surface-elevated text-foreground"
                  }`}
                  title={isMicMuted ? "Activer micro" : "Couper micro"}
                >
                  <Icon name={isMicMuted ? "mic_off" : "mic"} className="text-xl" />
                </button>

                {activeCall.call_type === "VIDEO" && (
                  <button
                    onClick={() => setIsCameraOff(!isCameraOff)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      isCameraOff ? "bg-red-500/20 text-red-500" : "bg-surface-elevated text-foreground"
                    }`}
                    title={isCameraOff ? "Activer caméra" : "Couper caméra"}
                  >
                    <Icon name={isCameraOff ? "videocam_off" : "videocam"} className="text-xl" />
                  </button>
                )}

                <button
                  onClick={handleEndCall}
                  className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-transform active:scale-95"
                  title="Raccrocher"
                >
                  <Icon name="call_end" className="text-2xl" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PAYMENT PROOF MODAL (Client Submission) */}
      {/* ==================================================================== */}
      {isPaymentProofModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4 text-xs text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
                <Icon name="upload_file" className="text-base" />
                Envoyer une preuve de paiement
              </h3>
              <button
                onClick={() => setIsPaymentProofModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-muted hover:bg-surface-elevated"
              >
                <Icon name="close" className="text-lg" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Capture d'écran / Photo du reçu :</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
                  className="w-full text-xs p-2 rounded-xl bg-surface-elevated border border-border"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Note complémentaire (optionnel) :</label>
                <textarea
                  rows={2}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Ex: Transfert Orange Money de 2 500 FCFA effectué avec succès..."
                  className="w-full p-2.5 rounded-xl bg-surface-elevated border border-border focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setIsPaymentProofModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-border hover:bg-surface-elevated font-semibold"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitProof}
                className="px-4 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary-hover shadow"
              >
                Envoyer la capture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MOBILE MONEY PAYMENT MODAL (LigdiCash API Orange / Moov) */}
      {/* ==================================================================== */}
      {isMobileMoneyModalOpen && activeConv?.order && (
        <MobileMoneyPaymentModal
          order={activeConv.order}
          isOpen={isMobileMoneyModalOpen}
          onClose={() => setIsMobileMoneyModalOpen(false)}
          onSuccess={async (paymentResult) => {
            setIsMobileMoneyModalOpen(false);
            showToast?.("🎉 Paiement Mobile Money validé ! Votre commande passe en préparation.");
            const updated = await fetchConversationDetail(activeConvId);
            setActiveConv(updated);
          }}
          showToast={showToast}
          customer={customer}
        />
      )}

      {/* ==================================================================== */}
      {/* MEDIA PREVIEW LIGHTBOX */}
      {/* ==================================================================== */}
      {previewMediaUrl && (
        <div
          onClick={() => setPreviewMediaUrl(null)}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer animate-fadeIn"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={previewMediaUrl} alt="Aperçu" className="w-full h-full object-contain rounded-xl shadow-2xl" />
            <button
              onClick={() => setPreviewMediaUrl(null)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
            >
              <Icon name="close" className="text-xl" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
