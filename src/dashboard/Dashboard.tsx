import { useState, useEffect, useMemo, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Search, Globe, ExternalLink, MoreVertical, Trash2 } from 'lucide-react';
import { db, type PageHistory } from '../lib/db';

interface DomainGroup {
  domain: string;
  color: string;
  tabs: PageHistory[];
  lastActive: number;
}

const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
};

const getBrandColor = (domain: string): string => {
  const brands: Record<string, string> = {
    'youtube.com': '#FF0000',
    'github.com': '#4ADE80',
    'twitter.com': '#1DA1F2',
    'x.com': '#FFFFFF',
    'google.com': '#4285F4',
    'v0.dev': '#A855F7',
    'stackoverflow.com': '#F48024',
    'reddit.com': '#FF4500',
    'amazon.com': '#FF9900',
    'netflix.com': '#E50914',
    'linkedin.com': '#0077B5',
  };
  return brands[domain] || stringToColor(domain);
};

export default function Dashboard() {
  const [items, setItems] = useState<PageHistory[]>([]);
  const [search, setSearch] = useState("");
  const [colCount, setColCount] = useState(4);
  const [columns, setColumns] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 1. Load Data
  useEffect(() => {
    const load = async () => {
      const history = await db.history.orderBy('timestamp').reverse().toArray();
      setItems(history);
    };
    load();
  }, []);

  // 2. Track Columns Responsive
  useLayoutEffect(() => {
    const updateColumns = (width: number) => {
      if (width < 640) setColCount(1);
      else if (width < 1024) setColCount(2);
      else if (width < 1400) setColCount(3);
      else setColCount(4);
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateColumns(entry.contentRect.width);
      }
    });

    const container = document.getElementById('dashboard-container');
    if (container) observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // 3. Process Groups & Distribute into Columns
  const groupsRaw = useMemo(() => {
    const filtered = items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()));
    const map: Record<string, DomainGroup> = {};
    filtered.forEach(item => {
      const domain = new URL(item.url).hostname.replace('www.', '');
      if (!map[domain]) {
        map[domain] = { domain, color: getBrandColor(domain), tabs: [], lastActive: item.timestamp };
      }
      map[domain].tabs.push(item);
    });
    // Sort all available groups by activity first
    return Object.values(map).sort((a, b) => b.lastActive - a.lastActive);
  }, [items, search]);

  // 4. Sycn State with Props & LocalStorage
  useEffect(() => {
    if (groupsRaw.length === 0) return;

    setColumns(prev => {
      // Load saved state if first run
      let next = { ...prev };
      const saved = localStorage.getItem(`dashboard-columns-${colCount}`);

      if (Object.keys(next).length === 0 && saved) {
        try { next = JSON.parse(saved); } catch { }
      }

      // Ensure all current columns exist
      for (let i = 0; i < colCount; i++) {
        if (!next[i]) next[i] = [];
      }

      // Find "orphaned" groups (newly active or simple not in state yet)
      const allTracked = new Set(Object.values(next).flat());
      const orphans = groupsRaw.filter(g => !allTracked.has(g.domain));

      // Append orphans to the shortest column to maintain balance
      orphans.forEach(g => {
        let minCol = "0";
        let minLen = Infinity;

        for (let i = 0; i < colCount; i++) {
          const len = next[String(i)]?.length || 0;
          if (len < minLen) {
            minLen = len;
            minCol = String(i);
          }
        }
        next[minCol] = [...(next[minCol] || []), g.domain];
      });

      // Cleanup: Remove domains that no longer exist in data (e.g. deleted history)
      const currentDomains = new Set(groupsRaw.map(g => g.domain));
      Object.keys(next).forEach(key => {
        next[key] = next[key].filter(d => currentDomains.has(d));
      });

      return next;
    });
  }, [groupsRaw, colCount]);

  // Persist whenever columns change
  useEffect(() => {
    if (Object.keys(columns).length > 0) {
      localStorage.setItem(`dashboard-columns-${colCount}`, JSON.stringify(columns));
    }
  }, [columns, colCount]);


  const findContainer = (id: string) => {
    if (Object.keys(columns).includes(id)) return id;
    return Object.keys(columns).find((key) => columns[key].includes(id));
  };


  const handleDragStart = (event: { active: { id: string | number } }) => {
    const { active } = event;
    setActiveId(String(active.id));
    const element = document.getElementById(`group-${active.id}`);
    if (element) {
      setActiveWidth(element.getBoundingClientRect().width);
    }
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setColumns((prev) => {
      const overItems = prev[overContainer];
      const overIndex = overItems.indexOf(String(over.id));

      let newIndex;
      if (over.id in prev) {
        newIndex = overItems.length + 1;
      } else {
        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top > over.rect.top + over.rect.height;

        const modifier = isBelowOverItem ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
      }

      return {
        ...prev,
        [activeContainer]: [
          ...prev[activeContainer].filter((item) => item !== active.id),
        ],
        [overContainer]: [
          ...prev[overContainer].slice(0, newIndex),
          active.id as string,
          ...prev[overContainer].slice(newIndex, prev[overContainer].length),
        ].filter(Boolean) as string[], // Ensure typing
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    const activeContainer = findContainer(String(active.id));
    const overContainer = over ? findContainer(String(over.id)) : null;

    if (activeContainer && overContainer) {
      const activeIndex = columns[activeContainer].indexOf(active.id as string);
      const overIndex = over ? columns[overContainer].indexOf(String(over.id)) : -1;

      if (activeIndex !== overIndex || activeContainer !== overContainer) {
        setColumns((prev) => {
          const newCols = { ...prev };
          // Move logic handled mostly by DragOver, 
          // but ArrayMove ensures final index precision within same container
          if (activeContainer === overContainer) {
            newCols[activeContainer] = arrayMove(prev[activeContainer], activeIndex, overIndex);
          }
          return newCols;
        });
      }
    }
  };

  const handleDeleteGroup = async (e: React.MouseEvent, domain: string) => {
    e.stopPropagation();
    try {
      if (confirm(`Delete all history from ${domain}?`)) {
        // Delete from DB where url contains domain is tricky with Dexie basic.
        // Better: Find IDs first.
        const itemsToDelete = items.filter(i => new URL(i.url).hostname.includes(domain));
        const ids = itemsToDelete.map(i => i.id).filter(Boolean) as number[];

        await db.history.bulkDelete(ids);
        setItems(prev => prev.filter(i => !ids.includes(i.id!)));
      }
    } catch (err) {
      console.error("Failed to delete group", err);
    }
  };

  const handleDeleteTab = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (!id) return;
    try {
      await db.history.delete(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      console.error("Failed to delete tab", err);
    }
  };

  return (
    <div id="dashboard-container" className="min-h-screen bg-[#050505] text-white p-4 pb-20 selection:bg-white/20">
      <div className="max-w-xl mx-auto mb-8 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search"
          className="w-full bg-[#1A1A1A] border border-zinc-800 rounded-full py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 ring-white/10 transition-all"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 items-start w-full px-2" style={{ flexDirection: 'row' }}>
          {/* Render explicit columns */}
          {Array.from({ length: colCount }).map((_, index) => {
            const colId = String(index);
            const domainIds = columns[colId] || [];

            return (
              <div key={colId} className="flex-1 flex flex-col gap-4 min-w-0">
                <SortableContext
                  id={colId}
                  items={domainIds}
                  strategy={rectSortingStrategy}
                >
                  {domainIds.map(domain => {
                    const group = groupsRaw.find(g => g.domain === domain);
                    if (!group) return null;
                    return (
                      <SortableWebsiteGroup
                        key={domain}
                        group={group}
                        onDeleteGroup={handleDeleteGroup}
                        onDeleteTab={handleDeleteTab}
                      />
                    );
                  })}
                </SortableContext>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeId ? (
            <div style={{ transform: 'none', width: activeWidth ? activeWidth : undefined }}>
              <WebsiteGroup
                group={groupsRaw.find(g => g.domain === activeId)!}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

interface GroupProps {
  group: DomainGroup;
  onDeleteGroup?: (e: React.MouseEvent, domain: string) => void;
  onDeleteTab?: (e: React.MouseEvent, id?: number) => void;
}

function SortableWebsiteGroup({ group, onDeleteGroup, onDeleteTab }: GroupProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: group.domain });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      id={`group-${group.domain}`}
    >
      <WebsiteGroup group={group} onDeleteGroup={onDeleteGroup} onDeleteTab={onDeleteTab} />
    </div>
  );
}

function WebsiteGroup({ group, isOverlay, onDeleteGroup, onDeleteTab }: GroupProps & { isOverlay?: boolean }) {
  return (
    <motion.div
      className={`break-inside-avoid relative group rounded-[2rem] p-[1.5px] transition-all duration-500 ${isOverlay ? 'shadow-2xl scale-105 z-50' : ''}`}
    >
      {/* The Glow Layer */}
      <div
        className="absolute inset-0 opacity-20 group-hover:opacity-100 transition-opacity duration-700 blur-[12px]"
        style={{ background: `linear-gradient(135deg, ${group.color}, transparent 60%)` }}
      />

      {/* Card Body */}
      <div className="relative bg-[#0F0F0F] rounded-[1.95rem] overflow-hidden border border-white/[0.05]">
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center border border-white/5 overflow-hidden shrink-0">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${group.domain}&sz=64`}
                  alt={group.domain}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <Globe className="w-4 h-4 hidden" style={{ color: group.color }} />
              </div>
              <span className="text-[13px] font-bold tracking-widest text-zinc-400 uppercase">{group.domain}</span>
            </div>

            {/* Action Buttons: More vs Delete */}
            <div className="relative w-6 h-6 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 opacity-100 group-hover:opacity-0">
                <MoreVertical className="w-4 h-4 text-zinc-600" />
              </div>
              <button
                onClick={(e) => onDeleteGroup?.(e, group.domain)}
                className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded-full cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {group.tabs.map((tab) => (
              <TabCard key={tab.id} tab={tab} accent={group.color} onDelete={onDeleteTab} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TabCard({ tab, accent, onDelete }: { tab: PageHistory; accent: string; onDelete?: (e: React.MouseEvent, id?: number) => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const hasImage = !!tab.image;

  return (
    <motion.div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={false}
      // Animate height and color
      animate={{
        height: isHovered && hasImage ? 200 : 'auto',
        backgroundColor: isHovered ? 'rgba(39, 39, 42, 0.95)' : 'rgba(24, 24, 27, 0.4)'
      }}
      // Scale is nice, but mixing it with height animation can be heavy. 
      // Keeping it very subtle and ensuring it uses the same transition logic.
      whileHover={{
        scale: 1.01,
        zIndex: 20,
      }}
      // Switch from 'spring' to a smooth 'tween' with custom ease
      transition={{
        duration: 0.2,
        ease: "easeOut" // or [0.25, 0.1, 0.25, 1] for slightly more natural feel
      }}
      className="relative rounded-xl p-3.5 cursor-pointer group/item border border-white/[0.05] overflow-hidden transition-all"
      onClick={() => window.open(tab.url, '_blank')}
    >
      {/* Background Image (Only visible on hover) */}
      {hasImage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.25 }} // Slightly slower than container for parallax feel
          className="absolute inset-0 z-0"
        >
          {/* Inner zoom effect - reduced intensity for smoothness */}
          <motion.div
            className="absolute inset-0"
            animate={{ scale: isHovered ? 1.05 : 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{
              backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.95) 15%, rgba(0,0,0,0.1) 100%), url(${tab.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        </motion.div>
      )}

      <div className="relative z-10 flex flex-col h-full justify-between pointer-events-none">
        <div className="flex justify-between items-start gap-2">
          <h3 className={`text-[13px] font-medium leading-snug transition-colors duration-200 flex-1 ${isHovered && hasImage ? 'text-white text-shadow-md line-clamp-2' : 'text-zinc-300 line-clamp-1 group-hover/item:text-white'}`}>
            {tab.title}
          </h3>

          <div className="flex items-center gap-2 shrink-0">
            {/* Delete Button (Split Animation) */}
            <button
              onClick={(e) => onDelete?.(e, tab.id)}
              className="w-0 p-0 overflow-hidden opacity-0 group-hover/item:w-6 group-hover/item:opacity-100 transition-all duration-300 text-red-400 hover:text-red-300 flex items-center justify-center pointer-events-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <ExternalLink className={`w-3 h-3 shrink-0 transition-colors ${isHovered && hasImage ? 'text-white/80' : 'text-zinc-600 opacity-0 group-hover/item:opacity-100 group-hover/item:text-white'}`} />
          </div>
        </div>

        {/* 
            Context Logic:
            - If it has an image: NEVER show text (clean aesthetic requested).
            - If text-only: Show text ONLY on hover.
        */}
        <AnimatePresence>
          {!hasImage && isHovered && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <p className="text-[12px] leading-relaxed text-zinc-400 border-l-2 pl-3" style={{ borderColor: accent }}>
                {tab.description || tab.snippet || "No additional context."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}