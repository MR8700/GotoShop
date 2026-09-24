import React, { useState, useEffect } from "react";
import Icon from "./Icon";
import { fetchDecisionInsights } from "../api/client";

export default function DecisionSupportWidget({ store, onNavigate }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (store?.id) {
      loadInsights();
    }
  }, [store?.id]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      const res = await fetchDecisionInsights(store.slug || store.id);
      setInsights(res.insights || []);
    } catch (e) {
      // Non-blocking
    } finally {
      setLoading(false);
    }
  };

  if (loading || insights.length === 0) return null;

  return (
    <div className="space-y-2 mb-4 animate-fade-in">
      <div className="flex items-center gap-1.5 px-1 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
        <Icon name="lightbulb" className="text-[16px] text-amber-500" />
        <span>Aide à l'activité &amp; Priorités</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {insights.map((item) => {
          const isHigh = item.priority === "HIGH";
          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 shadow-xs ${
                isHigh
                  ? "bg-amber-500/10 border-amber-500/30 text-on-surface"
                  : "bg-surface-secondary border-subtle text-on-surface"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isHigh
                    ? "bg-amber-500 text-white"
                    : "bg-primary/10 text-primary"
                }`}
              >
                <Icon name={item.icon || "info"} className="text-[18px]" />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <h4 className="text-xs font-bold leading-tight truncate">
                  {item.title}
                </h4>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  {item.description}
                </p>

                {item.action_label && (
                  <div className="pt-1">
                    <button
                      onClick={() => onNavigate && onNavigate(item.action_url)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                    >
                      <span>{item.action_label}</span>
                      <Icon name="arrow_forward" className="text-[13px]" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
