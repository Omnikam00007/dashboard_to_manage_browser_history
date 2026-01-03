import { useState, useEffect, useMemo, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Globe, ExternalLink, MoreVertical } from 'lucide-react';
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

  useEffect(() => {
    const load = async () => {
      const history = await db.history.orderBy('timestamp').reverse().toArray();
      setItems(history);
    };
    load();
  }, []);



  useLayoutEffect(() => {
    const updateColumns = (width: number) => {
      if (width < 640) setColCount(1);
      else if (width < 1024) setColCount(2);
      else if (width < 1400) setColCount(3);
      else setColCount(4);
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {

        requestAnimationFrame(() => {
          updateColumns(entry.contentRect.width);
        });
      }
    });

    const container = document.getElementById('dashboard-container');
    if (container) observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const groups = useMemo(() => {
    const filtered = items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()));
    const map: Record<string, DomainGroup> = {};

    filtered.forEach(item => {
      const domain = new URL(item.url).hostname.replace('www.', '');
      if (!map[domain]) {
        map[domain] = { domain, color: getBrandColor(domain), tabs: [], lastActive: item.timestamp };
      }
      map[domain].tabs.push(item);
    });
    return Object.values(map).sort((a, b) => b.lastActive - a.lastActive);
  }, [items, search]);

  const masonryColumns = useMemo(() => {
    const cols: DomainGroup[][] = Array.from({ length: colCount }, () => []);
    const colHeights = new Array(colCount).fill(0);

    groups.forEach((group) => {

      const groupHeight = 80 + (group.tabs.length * 60) + 20;

      const minH = Math.min(...colHeights);
      const minIdx = colHeights.indexOf(minH);

      cols[minIdx].push(group);
      colHeights[minIdx] += groupHeight;
    });
    return cols;
  }, [groups, colCount]);

  return (
    <div id="dashboard-container" className="min-h-screen bg-[#050505] text-white p-4 pb-20 selection:bg-white/20">
      {/* Search Bar matching image_6a4b5d.jpg */}
      <div className="max-w-xl mx-auto mb-8 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search"
          className="w-full bg-[#1A1A1A] border border-zinc-800 rounded-full py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 ring-white/10 transition-all"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Flex-based Masonry Grid (Full Width, Denser) */}
      <div className="w-full px-2 flex gap-4 items-start">
        {masonryColumns.map((col, colIndex) => (
          <div key={colIndex} className="flex-1 space-y-4 min-w-0">
            {col.map((group) => (
              <WebsiteGroup key={group.domain} group={group} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function WebsiteGroup({ group }: { group: DomainGroup }) {
  return (
    <motion.div
      className="break-inside-avoid relative group rounded-[2rem] p-[1.5px] transition-all duration-500"
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
            <MoreVertical className="w-4 h-4 text-zinc-600" />
          </div>

          <div className="flex flex-col gap-3">
            {group.tabs.map((tab) => (
              <TabCard key={tab.id} tab={tab} accent={group.color} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TabCard({ tab, accent }: { tab: PageHistory; accent: string }) {
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
          <h3 className={`text-[13px] font-medium leading-snug transition-colors duration-200 ${isHovered && hasImage ? 'text-white text-shadow-md line-clamp-2' : 'text-zinc-300 line-clamp-1 group-hover/item:text-white'}`}>
            {tab.title}
          </h3>
          <ExternalLink className={`w-3 h-3 shrink-0 transition-colors ${isHovered && hasImage ? 'text-white/80' : 'text-zinc-600 opacity-0 group-hover/item:opacity-100 group-hover/item:text-white'}`} />
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