'use client';

import { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Search,
  Plus,
  Download,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Tag,
  Flame,
  Code2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { useAuthGuard } from '@/lib/hooks/use-auth-guard';
import { api } from '@/lib/api';
import type { SecurityRule, Severity } from '@valorasec/shared';

const CATEGORIES = [
  'all',
  'authorization',
  'storage',
  'input-validation',
  'code-quality',
  'gas-optimization',
  'panic-safety',
];

const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low'];

export default function RulesMarketplacePage() {
  const { shouldRender } = useAuthGuard();
  const [rules, setRules] = useState<SecurityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedSort, setSelectedSort] = useState<'popular' | 'recent' | 'name'>('popular');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('authorization');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [description, setDescription] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [pattern, setPattern] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await api.getRules({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        severity: selectedSeverity !== 'all' ? selectedSeverity : undefined,
        search: search.trim() || undefined,
        sort: selectedSort,
        limit: 50,
      });
      setRules(res.data);
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!shouldRender) return;
    fetchRules();
  }, [shouldRender, selectedCategory, selectedSeverity, selectedSort]);

  const handleToggle = async (ruleId: string) => {
    setActionInProgress(ruleId);
    try {
      const res = await api.toggleRule(ruleId);
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled: res.data.enabled } : r)),
      );
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleInstall = async (ruleId: string) => {
    setActionInProgress(ruleId);
    try {
      const res = await api.installRule(ruleId);
      setRules((prev) =>
        prev.map((r) =>
          r.id === ruleId ? { ...r, downloads: res.data.downloads, enabled: res.data.enabled } : r,
        ),
      );
    } catch (err) {
      console.error('Failed to install rule:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.exportRules(selectedCategory !== 'all' ? selectedCategory : undefined);
      const jsonStr = JSON.stringify(res.data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `valorasec-rules-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export rules:', err);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || !recommendation) return;

    setFormSubmitting(true);
    try {
      await api.createRule({
        name,
        title: title || undefined,
        category,
        severity,
        description,
        recommendation,
        pattern: pattern || undefined,
      });
      setShowCreateModal(false);
      setName('');
      setTitle('');
      setDescription('');
      setRecommendation('');
      setPattern('');
      await fetchRules();
    } catch (err) {
      console.error('Failed to create rule:', err);
    } finally {
      setFormSubmitting(false);
    }
  };

  if (!shouldRender) return null;

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-7xl px-6 py-8" tabIndex={-1}>
        {/* Header */}
        <div className="animate-fade-in mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-3xl font-bold">Security Rule Marketplace</h1>
              <Badge variant="low" className="border-primary/20">
                Community & Official
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Explore, enable, and contribute Soroban static analysis security rules
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1.5 h-4 w-4" /> Export JSON
            </Button>
            <Button variant="cyber" size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Submit Custom Rule
            </Button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="cyber-card mb-8 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Search security rules"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchRules()}
                placeholder="Search rules by name, description, keyword..."
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2"
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                aria-label="Filter by category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm capitalize focus:outline-none focus:ring-2"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    Category: {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <select
                aria-label="Sort rules"
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value as 'popular' | 'recent' | 'name')}
                className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              >
                <option value="popular">Sort: Most Popular</option>
                <option value="recent">Sort: Recently Added</option>
                <option value="name">Sort: Alphabetical</option>
              </select>
            </div>
          </div>

          {/* Severity quick tags */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
            <span className="text-muted-foreground font-medium">Severity:</span>
            {SEVERITIES.map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSelectedSeverity(sev)}
                className={`rounded px-2.5 py-1 uppercase tracking-wide transition-colors ${
                  selectedSeverity === sev
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Rule Cards Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-32" role="status">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <span className="sr-only">Loading security rules...</span>
          </div>
        ) : rules.length === 0 ? (
          <div className="cyber-card py-16 text-center">
            <ShieldAlert className="text-muted-foreground mx-auto mb-3 h-10 w-10 opacity-60" />
            <h3 className="font-heading text-lg font-bold">No security rules found</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Try adjusting your search criteria or category filter
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="cyber-card hover:border-primary/50 flex flex-col justify-between p-6 transition-all"
              >
                <div>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="text-primary font-mono text-xs font-semibold">{rule.id}</span>
                    <Badge variant={rule.severity === 'critical' ? 'critical' : 'high'}>
                      {rule.severity}
                    </Badge>
                  </div>

                  <h3 className="font-heading text-foreground text-lg font-bold">
                    {rule.title || rule.name}
                  </h3>
                  <p className="text-muted-foreground mt-1 font-mono text-xs text-opacity-80">
                    {rule.name}
                  </p>

                  <p className="text-muted-foreground mt-3 line-clamp-3 text-sm">
                    {rule.description}
                  </p>

                  {rule.pattern && (
                    <div className="bg-muted/60 mt-3 rounded p-2 font-mono text-xs">
                      <div className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase">
                        <Code2 className="h-3 w-3" /> Pattern DSL:
                      </div>
                      <span className="text-primary block truncate">{rule.pattern}</span>
                    </div>
                  )}

                  <div className="border-border/40 mt-4 border-t pt-3">
                    <p className="text-muted-foreground text-xs">
                      <span className="text-foreground font-semibold">Recommendation:</span>{' '}
                      {rule.recommendation}
                    </p>
                  </div>
                </div>

                <div className="border-border/40 mt-5 flex items-center justify-between border-t pt-4 text-xs">
                  <div className="text-muted-foreground flex items-center gap-3">
                    <span className="flex items-center gap-1 font-mono">
                      <Flame className="h-3.5 w-3.5 text-amber-500" />
                      {rule.downloads}
                    </span>
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {rule.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={actionInProgress === rule.id}
                      onClick={() => handleToggle(rule.id)}
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                      title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {rule.enabled ? (
                        <>
                          <ToggleRight className="text-primary h-5 w-5" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="text-muted-foreground h-5 w-5" />
                          <span>Off</span>
                        </>
                      )}
                    </button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionInProgress === rule.id}
                      onClick={() => handleInstall(rule.id)}
                      className="h-7 px-2 text-xs"
                    >
                      {actionInProgress === rule.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="mr-1 h-3 w-3 text-emerald-500" />
                          Install
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Custom Rule Modal */}
        {showCreateModal && (
          <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="cyber-card w-full max-w-lg p-6 shadow-2xl">
              <h2 className="font-heading mb-4 text-xl font-bold">Submit Custom Security Rule</h2>
              <form onSubmit={handleCreateRule} className="space-y-4">
                <div>
                  <label
                    htmlFor="rule-name"
                    className="text-muted-foreground mb-1 block text-xs font-medium"
                  >
                    Rule Name (Unique Identifier) *
                  </label>
                  <input
                    id="rule-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. check-contract-caller-reentrancy"
                    className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rule-title"
                    className="text-muted-foreground mb-1 block text-xs font-medium"
                  >
                    Human-readable Title
                  </label>
                  <input
                    id="rule-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Reentrancy Guard Verification"
                    className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="rule-category"
                      className="text-muted-foreground mb-1 block text-xs font-medium"
                    >
                      Category *
                    </label>
                    <select
                      id="rule-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    >
                      {CATEGORIES.filter((c) => c !== 'all').map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="rule-severity"
                      className="text-muted-foreground mb-1 block text-xs font-medium"
                    >
                      Severity *
                    </label>
                    <select
                      id="rule-severity"
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as Severity)}
                      className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                      <option value="informational">Informational</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="rule-description"
                    className="text-muted-foreground mb-1 block text-xs font-medium"
                  >
                    Description *
                  </label>
                  <textarea
                    id="rule-description"
                    required
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Explain what vulnerability or anti-pattern this rule detects..."
                    className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rule-recommendation"
                    className="text-muted-foreground mb-1 block text-xs font-medium"
                  >
                    Remediation / Recommendation *
                  </label>
                  <textarea
                    id="rule-recommendation"
                    required
                    rows={2}
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    placeholder="How should developers resolve this issue in Soroban Rust code?"
                    className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rule-pattern"
                    className="text-muted-foreground mb-1 block text-xs font-medium"
                  >
                    Regex or Code Pattern (Optional)
                  </label>
                  <input
                    id="rule-pattern"
                    type="text"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="e.g. require_auth\("
                    className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowCreateModal(false)}
                    disabled={formSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="cyber" disabled={formSubmitting}>
                    {formSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit Rule
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
