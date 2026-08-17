import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiRequest } from '../../../utils/apiClient';
import { candidateLabel } from '../../../utils/laximoVinCandidate';
import VinCatalogTree from './VinCatalogTree';
import VinCatalogNodeGrid from './VinCatalogNodeGrid';
import VinCatalogUnitView from './VinCatalogUnitView';
import VinCatalogPartDrawer from './VinCatalogPartDrawer';

function buildQuickTree(groups) {
  const list = Array.isArray(groups) ? groups : [];
  const byParent = new Map();
  list.forEach((g) => {
    const pid = g.parent_id || '';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(g);
  });
  const walk = (parentId) =>
    (byParent.get(parentId) || []).map((g) => {
      const kids = walk(g.quick_group_id || '');
      return {
        id: `qg-${g.quick_group_id}`,
        name: g.name || 'Группа',
        kind: 'quickgroup',
        raw: g,
        hasChildren: kids.length > 0 || g.link === false,
        children: kids,
      };
    });
  let roots = walk('');
  if (!roots.length) {
    roots = list.map((g) => ({
      id: `qg-${g.quick_group_id}`,
      name: g.name || 'Группа',
      kind: 'quickgroup',
      raw: g,
      hasChildren: g.link === false,
      children: [],
    }));
  }

  // Skip Laximo wrapper folders like «Легковые автомобили (NEW)».
  while (
    roots.length === 1
    && roots[0].children?.length
    && roots[0].raw?.link === false
  ) {
    roots = roots[0].children;
  }

  return roots;
}

function categoriesToNodes(cats) {
  return (cats || []).map((c) => ({
    id: `cat-${c.category_id}`,
    name: c.name || 'Категория',
    kind: 'category',
    raw: c,
    hasChildren: Boolean(c.has_children),
    children: undefined,
  }));
}

function unitsToNodes(units) {
  return (units || []).map((u) => ({
    id: `unit-${u.unit_id}`,
    name: u.name || u.code || 'Узел',
    kind: 'unit',
    raw: u,
    hasChildren: false,
    children: [],
    imageUrl: u.image_url || null,
  }));
}

export default function VinCatalogBrowse({
  vehicle,
  vin,
  fromWizard,
  loading,
  filterLoading,
  hasQuickgroups,
  hasFulltext,
  mode,
  quickGroups,
  treeCategories,
  panelCategories,
  units,
  selectedUnit,
  unitInfo,
  details,
  availability,
  availabilityLoading,
  imageMap,
  searchQuery,
  searchLoading,
  searchEmpty,
  filterStep,
  error,
  onSearchQueryChange,
  onRunSearch,
  onClearSearch,
  onSwitchMode,
  onOpenCategory,
  onOpenUnit,
  onOpenQuickGroup,
  onClearUnitView,
  onBeginDetailFilter,
  onSetFilterAnswer,
  onSubmitFilterStep,
  onCancelFilter,
  loadUsedProducts,
  vinBasketId = null,
  ensureVinBasket = null,
}) {
  const token = useSelector((state) => state.auth?.token);
  const [inGarage, setInGarage] = useState(null);
  const [treeOpenIds, setTreeOpenIds] = useState(() => new Set());
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [gridNodes, setGridNodes] = useState([]);
  const [panelMode, setPanelMode] = useState('grid');
  const [hoverRowKey, setHoverRowKey] = useState(null);
  const [drawerDetail, setDrawerDetail] = useState(null);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  const [childrenCache, setChildrenCache] = useState({});

  const title = candidateLabel(vehicle) || vehicle?.display_name || 'Автомобиль';

  useEffect(() => {
    let cancelled = false;
    if (!token || !vin) {
      setInGarage(false);
      return undefined;
    }
    (async () => {
      try {
        const list = await apiRequest('/autoservice/garage/vehicles');
        const rows = Array.isArray(list) ? list : [];
        const hit = rows.some(
          (v) => String(v?.vin || '').trim().toUpperCase() === String(vin).trim().toUpperCase()
        );
        if (!cancelled) setInGarage(hit);
      } catch {
        if (!cancelled) setInGarage(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, vin]);

  // Reset local UI when vehicle or catalog mode changes
  useEffect(() => {
    setChildrenCache({});
    setTreeOpenIds(new Set());
    setSelectedNodeId(null);
    setDrawerDetail(null);
    setHoverRowKey(null);
  }, [vehicle?.vehicle_id, vehicle?.catalog]);

  useEffect(() => {
    if (mode !== 'quick' && mode !== 'oem') return;
    setChildrenCache({});
    setTreeOpenIds(new Set());
    setSelectedNodeId(null);
  }, [mode]);

  const rootNodes = useMemo(() => {
    if (mode === 'quick') return buildQuickTree(quickGroups);
    if (mode === 'oem' || mode === 'search') {
      return categoriesToNodes(treeCategories).map((n) => {
        const cached = childrenCache[n.id];
        if (cached) {
          return { ...n, children: cached, hasChildren: cached.length > 0 || n.hasChildren };
        }
        return n;
      });
    }
    return [];
  }, [mode, quickGroups, treeCategories, childrenCache]);

  useEffect(() => {
    if (mode === 'search') {
      setPanelMode('search');
      return;
    }
    if (selectedUnit || unitInfo) {
      setPanelMode('unit');
      return;
    }
    setPanelMode('grid');
    if (mode === 'quick') {
      setGridNodes(buildQuickTree(quickGroups));
    } else {
      const catNodes = panelCategories?.length ? categoriesToNodes(panelCategories) : [];
      const unitNodes = units?.length ? unitsToNodes(units) : [];
      if (catNodes.length || unitNodes.length) {
        setGridNodes([...catNodes, ...unitNodes]);
      } else {
        setGridNodes(categoriesToNodes(treeCategories));
      }
    }
  }, [mode, quickGroups, treeCategories, panelCategories, units, selectedUnit, unitInfo]);

  const toggleTree = (id) => {
    setTreeOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectNode = async (node) => {
    setSelectedNodeId(node.id);
    setDrawerDetail(null);
    setHoverRowKey(null);
    setMobileTreeOpen(false);

    if (node.kind === 'quickgroup') {
      const g = node.raw;
      if (node.children?.length) {
        setTreeOpenIds((prev) => new Set(prev).add(node.id));
        onClearUnitView?.();
        setPanelMode('grid');
        setGridNodes(node.children);
        return;
      }
      if (g.link === false) {
        toggleTree(node.id);
        return;
      }
      setPanelMode('unit');
      await onOpenQuickGroup(g);
      return;
    }

    if (node.kind === 'category') {
      setTreeOpenIds((prev) => new Set(prev).add(node.id));
      onClearUnitView?.();
      setPanelMode('grid');
      await onOpenCategory(node.raw);
      return;
    }

    if (node.kind === 'unit') {
      setPanelMode('unit');
      await onOpenUnit(node.raw);
    }
  };

  // Sync fetched children into tree cache after category open
  useEffect(() => {
    if (!selectedNodeId || !selectedNodeId.startsWith('cat-')) return;
    const panelIds = new Set((panelCategories || []).map((c) => `cat-${c.category_id}`));
    const catsAreChildren = Boolean(panelCategories?.length) && !panelIds.has(selectedNodeId);
    const catNodes = catsAreChildren ? categoriesToNodes(panelCategories) : [];
    const unitNodes = units?.length ? unitsToNodes(units) : [];
    if (!catNodes.length && !unitNodes.length) return;
    const nodes = [...catNodes, ...unitNodes];
    setChildrenCache((prev) => ({ ...prev, [selectedNodeId]: nodes }));
    setGridNodes(nodes);
    setTreeOpenIds((prev) => new Set(prev).add(selectedNodeId));
  }, [panelCategories, units, selectedNodeId, mode]);

  const treeNodesWithCache = useMemo(() => {
    const attach = (nodes) =>
      (nodes || []).map((n) => {
        const cached = childrenCache[n.id];
        const children = cached !== undefined ? cached : n.children;
        return {
          ...n,
          children: children ? attach(children) : children,
          hasChildren: n.hasChildren || Boolean(children?.length),
        };
      });
    return attach(rootNodes);
  }, [rootNodes, childrenCache]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="min-w-0 text-sm font-semibold text-gray-900 sm:text-base">{title}</h2>
        {vin && !fromWizard ? (
          <span className="font-mono text-xs text-gray-400">{vin}</span>
        ) : null}
        {fromWizard ? (
          <span className="text-xs text-amber-700">по параметрам</span>
        ) : null}
        {inGarage === true ? (
          <span className="text-xs font-medium text-emerald-700">в гараже</span>
        ) : null}
        {!token && inGarage === false ? (
          <Link to="/login" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
            Войти
          </Link>
        ) : null}
      </div>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTreeOpen((v) => !v)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800"
        >
          {mobileTreeOpen ? 'Скрыть разделы' : 'Разделы'}
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside
          className={`rounded-lg border border-gray-200 bg-white ${
            mobileTreeOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          <VinCatalogTree
            nodes={treeNodesWithCache}
            openIds={treeOpenIds}
            selectedId={selectedNodeId}
            hasFulltext={hasFulltext}
            hasQuickgroups={hasQuickgroups}
            mode={mode}
            searchQuery={searchQuery}
            searchLoading={searchLoading}
            onToggle={toggleTree}
            onSelect={handleSelectNode}
            onSearchQueryChange={onSearchQueryChange}
            onRunSearch={onRunSearch}
            onClearSearch={onClearSearch}
            onSwitchMode={onSwitchMode}
          />
        </aside>

        <section className="min-w-0 self-start rounded-lg border border-gray-200 bg-white p-2 sm:p-3">
          {loading || filterLoading ? (
            !details.length ? (
              <p className="text-sm text-gray-500">Загрузка…</p>
            ) : null
          ) : null}
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

          {filterStep ? (
            <div className="mb-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <p className="text-sm font-medium text-gray-900">Комплектация</p>
              {filterStep.conditions.map((cond, idx) => {
                const isInput = cond.type === 'input';
                const values = Array.isArray(cond.values) ? cond.values : [];
                return (
                  <div key={`${cond.name || 'c'}-${idx}`}>
                    <label className="block text-sm text-gray-700">{cond.name || `Параметр ${idx + 1}`}</label>
                    {isInput ? (
                      <input
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        value={filterStep.answers[idx] || ''}
                        onChange={(e) => onSetFilterAnswer(idx, e.target.value)}
                      />
                    ) : (
                      <select
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        value={filterStep.answers[idx] || ''}
                        onChange={(e) => onSetFilterAnswer(idx, e.target.value)}
                      >
                        <option value="">Выберите…</option>
                        {values.map((v) => (
                          <option key={v.ssd_modification || v.name} value={v.ssd_modification || v.name}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onSubmitFilterStep}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Применить
                </button>
                <button
                  type="button"
                  onClick={onCancelFilter}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : null}

          {panelMode === 'search' || mode === 'search' ? (
            <VinCatalogUnitView
              title={unitInfo?.name || 'Поиск'}
              imageUrl={null}
              imageMap={[]}
              details={details}
              availability={availability}
              availabilityLoading={availabilityLoading}
              searchEmpty={searchEmpty}
              hoverRowKey={hoverRowKey}
              onHoverRowKey={setHoverRowKey}
              onSelectDetail={setDrawerDetail}
              onDetailFilter={onBeginDetailFilter}
            />
          ) : panelMode === 'unit' && (selectedUnit || unitInfo) ? (
            <VinCatalogUnitView
              title={unitInfo?.name || selectedUnit?.name || 'Узел'}
              imageUrl={unitInfo?.image_url}
              imageMap={imageMap}
              details={details}
              availability={availability}
              availabilityLoading={availabilityLoading}
              searchEmpty={false}
              hoverRowKey={hoverRowKey}
              onHoverRowKey={setHoverRowKey}
              onSelectDetail={setDrawerDetail}
              onDetailFilter={onBeginDetailFilter}
            />
          ) : (
            <VinCatalogNodeGrid nodes={gridNodes} onSelect={handleSelectNode} />
          )}
        </section>
      </div>

      <VinCatalogPartDrawer
        detail={drawerDetail}
        onClose={() => setDrawerDetail(null)}
        loadUsedProducts={loadUsedProducts}
        vinBasketId={vinBasketId}
        ensureVinBasket={ensureVinBasket}
      />
    </div>
  );
}
