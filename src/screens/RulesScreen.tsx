import { useEffect, useMemo, useState } from 'react';
import './RulesScreen.css';
import { BLOCKLIST_CATALOG } from '../data/blocklistCatalog';
import { AmethystBlocker, type InstalledAppInfo } from '../native/AmethystNativeBridge';
import {
  rulesStore,
  selectedRuleStore,
  sessionStore,
  type StoredRule,
} from '../state/localState';
import { dateKeyAt } from '../engine/policy';
import { toRuleSpec } from '../state/amethystState';
import { BlockedAppsStrip } from '../components/rules/BlockedAppsStrip';
import { RuleDetailSheet } from '../components/rules/RuleDetailSheet';
import { RuleEditorSheet } from '../components/rules/RuleEditorSheet';
import { RuleTile } from '../components/rules/RuleTile';

type View = 'apps' | 'rules';

function createId() {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createDraft(rule?: StoredRule): StoredRule {
  return rule ?? {
    id: createId(),
    name: 'New Block',
    enabled: true,
    mode: 'blocklist',
    siteIds: ['instagram', 'tiktok'],
    recurrence: 'always',
    difficulty: 'easy',
    unblocksPerDay: 3,
    unblocksUsedToday: 0,
    presetIcon: 'lock',
  };
}

function siteName(siteId: string) {
  return BLOCKLIST_CATALOG.find((site) => site.id === siteId)?.name ?? siteId;
}

export function RulesScreen() {
  const [rules, setRules] = useState<StoredRule[]>([]);
  const [installedApps, setInstalledApps] = useState<InstalledAppInfo[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(() => selectedRuleStore.get() || null);
  const [view, setView] = useState<View>('apps');
  const [detailRuleId, setDetailRuleId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);

  useEffect(() => {
    const saved = rulesStore.getAll();
    const shouldMigrateLegacySeed = saved.some((rule) => ['Work Hours', 'Bedtime Shield', 'Doomscroll Patrol'].includes(rule.name));
    if (saved.length && !shouldMigrateLegacySeed) {
      setRules(saved);
    } else {
      setRules([]);
      rulesStore.save([]);
    }

    void AmethystBlocker.getInstalledApps().then(({ apps }) => setInstalledApps(apps));
    void AmethystBlocker.getEngineStatus().then((status) => {
      const today = dateKeyAt(Date.now());
      const usedByRule = new Map(
        status.unblockUsage
          .filter((record) => record.date === today)
          .map((record) => [record.ruleId, record.used])
      );
      setRules((current) => current.map((rule) => ({
        ...rule,
        unblocksUsedToday: usedByRule.get(rule.id) ?? 0,
      })));
    });
  }, []);

  const selectedRule = rules.find((rule) => rule.id === selectedRuleId);
  const detailRule = rules.find((rule) => rule.id === detailRuleId);
  const blockedEntries = useMemo(() => {
    const rule = selectedRule ?? rules[0];
    if (!rule) return [];
    return [
      ...rule.siteIds.map((siteId) => ({ id: siteId, label: siteName(siteId) })),
      ...(rule.packageNames ?? []).map((packageName) => ({
        id: packageName,
        label: installedApps.find((app) => app.packageName === packageName)?.label ?? 'App',
      })),
    ].slice(0, 7);
  }, [installedApps, rules, selectedRule]);

  function findRuleForEntry(entryId: string) {
    return rules.find((rule) => rule.siteIds.includes(entryId) || (rule.packageNames ?? []).includes(entryId));
  }

  function persist(next: StoredRule[]) {
    rulesStore.save(next);
    setRules(next);
  }

  function selectRule(rule: StoredRule) {
    setSelectedRuleId(rule.id);
    selectedRuleStore.set(rule.id);
  }

  function saveRule(rule: StoredRule) {
    const exists = rules.some((item) => item.id === rule.id);
    const next = exists ? rules.map((item) => item.id === rule.id ? rule : item) : [...rules, rule];
    persist(next);
    selectRule(rule);
    setEditingId(null);
    setDetailRuleId(rule.id);
  }

  function deleteRule(id: string) {
    const deletedRule = rules.find((rule) => rule.id === id);
    const next = rules.filter((rule) => rule.id !== id);
    persist(next);

    // Sync native layer so the deleted rule's alarm is dropped.
    void AmethystBlocker.syncRules({
      rules: next.map((rule) => toRuleSpec({
        ...rule,
        packageNames: rule.packageNames ?? [],
        days: rule.days ?? [0, 1, 2, 3, 4, 5, 6],
      })),
    });

    // If the deleted rule was powering an active session, stop it.
    const activeSession = sessionStore.get();
    if (deletedRule && activeSession?.active && activeSession.ruleId === id) {
      void AmethystBlocker.stopFocusSession();
      sessionStore.set(null);
    }

    if (selectedRuleId === id) {
      const replacement = next[0]?.id ?? '';
      setSelectedRuleId(replacement || null);
      selectedRuleStore.set(replacement);
    }
    setEditingId(null);
    setDetailRuleId(null);
  }

  return (
    <main className="rules-screen amethyst-apps-screen">
      {view === 'apps' && (
        <>
          <header className="amethyst-apps-header">
            <h1>Apps</h1>
          </header>

          {blockedEntries.length > 0 ? (
            <BlockedAppsStrip
              apps={blockedEntries}
              installedApps={installedApps}
              onAppPress={(entry) => {
                const owner = findRuleForEntry(entry.id) ?? selectedRule ?? rules[0];
                if (owner) {
                  setDetailRuleId(owner.id);
                } else {
                  setEditingId('new');
                }
              }}
            />
          ) : (
            <section className="amethyst-apps-empty">
              <div className="amethyst-apps-empty__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="48" height="48"><path d="M12 3.5 3.5 7.7v8.6L12 20.5l8.5-4.2V7.7Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><path d="M12 12v8.5M3.5 7.7 12 12l8.5-4.3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
              </div>
              <h2>No blocked apps yet</h2>
              <p>Create a schedule to start blocking distracting apps and build better habits.</p>
              <button className="amethyst-apps-empty__cta" onClick={() => setEditingId('new')}>+ Create your first schedule</button>
            </section>
          )}

          <section className="apps-section" aria-labelledby="rules-preview-title">
            <div className="apps-section__header">
              <h2 id="rules-preview-title">Schedules</h2>
              <button className="apps-text-action" onClick={() => setView('rules')} aria-label="See all schedules">→</button>
            </div>
            <div className="rules-rail" role="list">
              {rules.slice(0, 5).map((rule, index) => (
                <RuleTile
                  key={rule.id}
                  rule={rule}
                  index={index}
                  selected={selectedRuleId === rule.id}
                  onPress={() => {
                    selectRule(rule);
                    setDetailRuleId(rule.id);
                  }}
                />
              ))}
              <button className="rule-create-tile amethyst-feature-card" onClick={() => setEditingId('new')} aria-label="Create a new schedule">
                <span>+</span>
                <strong>New schedule</strong>
              </button>
            </div>
          </section>
        </>
      )}

      {view === 'rules' && (
        <section className="rules-list-view">
          <header className="nested-screen-header">
            <button onClick={() => setView('apps')} aria-label="Back to My apps">‹</button>
            <div><p>AMETHYST</p><h1>Your schedules</h1></div>
            <button className="nested-screen-header__add" onClick={() => setEditingId('new')} aria-label="Create a schedule">+</button>
          </header>
          <p className="nested-screen-intro">Choose what you want to protect. Schedules can run all day or at set times.</p>
          <div className="rules-list" role="list">
            {rules.map((rule, index) => (
              <RuleTile
                key={rule.id}
                rule={rule}
                index={index}
                selected={selectedRuleId === rule.id}
                compact
                onPress={() => {
                  selectRule(rule);
                  setDetailRuleId(rule.id);
                }}
              />
            ))}
          </div>
          <button className="rules-new-button" onClick={() => setEditingId('new')}>+ Create a schedule</button>
        </section>
      )}

      {detailRule && !editingId && (
        <RuleDetailSheet
          rule={detailRule}
          installedApps={installedApps}
          onClose={() => setDetailRuleId(null)}
          onSelect={() => {
            selectRule(detailRule);
            setDetailRuleId(null);
          }}
          onEdit={() => setEditingId(detailRule.id)}
        />
      )}

      {editingId && (
        <RuleEditorSheet
          initial={editingId === 'new' ? createDraft() : rules.find((rule) => rule.id === editingId)}
          installedApps={installedApps}
          onSave={saveRule}
          onDelete={editingId === 'new' ? undefined : () => deleteRule(editingId)}
          onClose={() => setEditingId(null)}
        />
      )}
    </main>
  );
}
