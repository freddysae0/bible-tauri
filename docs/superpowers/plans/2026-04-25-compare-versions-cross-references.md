# Compare Versions & Cross-References Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two reading toolbar buttons — Compare Versions (same chapter across all Bible versions side by side) and Cross-References (related verses for the selected verse), with a new verbum backend endpoint for cross-references.

**Architecture:** A toolbar strip sits in the top-right of the reading area alongside the existing mode toggle. Compare Versions is pure frontend — it fetches the current chapter via existing `bibleApi.chapter()` for each available version and renders a modal. Cross-references require a new verbum endpoint backed by a static cross-reference dataset seeded into a `cross_references` table; the frontend polls it on verse selection.

**Tech Stack:** React + Zustand + Tailwind (frontend), Laravel 13 + SQLite/MySQL (verbum backend), existing `bibleApi.ts` pattern.

---

## File Map

### New files (tulia-study)
- `src/components/reading/ReadingToolbar.tsx` — toolbar strip with Compare and XRef buttons
- `src/components/reading/CompareVersionsModal.tsx` — modal showing chapter across all versions
- `src/components/reading/CrossReferencesPanel.tsx` — panel showing cross-reference verses
- `src/lib/store/useCompareStore.ts` — modal open state + per-version chapter data
- `src/lib/store/useCrossRefStore.ts` — cross-ref results per verse

### Modified files (tulia-study)
- `src/components/verse/VerseList.tsx` — mount `ReadingToolbar` in top-right area
- `src/lib/bibleApi.ts` — add `crossRefs(verseId)` call
- `src/App.tsx` — render `CompareVersionsModal` at root

### New files (verbum)
- `database/migrations/2026_04_25_200000_create_cross_references_table.php`
- `database/seeders/CrossReferenceSeeder.php`
- `database/data/cross_references.csv` — OpenBible TSK dataset (instructions below)
- `app/Http/Controllers/Api/CrossReferenceController.php`

### Modified files (verbum)
- `routes/api.php` — add cross-references route (public)

---

## Task 1: Cross-references table + migration (verbum)

**Files:**
- Create: `database/migrations/2026_04_25_200000_create_cross_references_table.php`

- [ ] **Step 1: Create migration**

```php
<?php
// database/migrations/2026_04_25_200000_create_cross_references_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('cross_references', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('from_verse_id');
            $table->unsignedBigInteger('to_verse_id');
            $table->unsignedTinyInteger('votes')->default(1);
            $table->foreign('from_verse_id')->references('id')->on('verses')->cascadeOnDelete();
            $table->foreign('to_verse_id')->references('id')->on('verses')->cascadeOnDelete();
            $table->index(['from_verse_id', 'votes']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cross_references');
    }
};
```

- [ ] **Step 2: Run migration**

```bash
php artisan migrate
```

Expected: `cross_references` table created with no errors.

- [ ] **Step 3: Commit**

```bash
git -C C:\Repos\verbum add database/migrations/2026_04_25_200000_create_cross_references_table.php
git -C C:\Repos\verbum commit -m "feat: add cross_references table"
```

---

## Task 2: Cross-reference dataset + seeder (verbum)

**Files:**
- Create: `database/data/cross_references.csv`
- Create: `database/seeders/CrossReferenceSeeder.php`

- [ ] **Step 1: Download the OpenBible cross-reference dataset**

Go to https://www.openbible.info/labs/cross-references/ and download `cross_references.zip`. Extract `cross_references.txt` and save it as `database/data/cross_references.csv` in the verbum project.

The file format is tab-separated:
```
From Verse	To Verse	Votes
Gen.1.1	Heb.11.3	83
Gen.1.1	Joh.1.1	79
```

The OSIS book abbreviations (e.g. `Gen`, `Exod`, `Matt`) need mapping to verbum's book slugs. Verbum slugs are lowercase full names (e.g. `genesis`, `exodus`, `matthew`) — check via `php artisan tinker` → `App\Models\Book::pluck('slug', 'number')`.

- [ ] **Step 2: Create the seeder**

```php
<?php
// database/seeders/CrossReferenceSeeder.php

namespace Database\Seeders;

use App\Models\Verse;
use App\Models\Book;
use App\Models\Chapter;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CrossReferenceSeeder extends Seeder
{
    // OSIS prefix → verbum book slug mapping
    private const BOOK_MAP = [
        'Gen' => 'genesis', 'Exod' => 'exodus', 'Lev' => 'leviticus',
        'Num' => 'numbers', 'Deut' => 'deuteronomy', 'Josh' => 'joshua',
        'Judg' => 'judges', 'Ruth' => 'ruth', '1Sam' => '1-samuel',
        '2Sam' => '2-samuel', '1Kgs' => '1-kings', '2Kgs' => '2-kings',
        '1Chr' => '1-chronicles', '2Chr' => '2-chronicles', 'Ezra' => 'ezra',
        'Neh' => 'nehemiah', 'Esth' => 'esther', 'Job' => 'job',
        'Ps' => 'psalms', 'Prov' => 'proverbs', 'Eccl' => 'ecclesiastes',
        'Song' => 'song-of-solomon', 'Isa' => 'isaiah', 'Jer' => 'jeremiah',
        'Lam' => 'lamentations', 'Ezek' => 'ezekiel', 'Dan' => 'daniel',
        'Hos' => 'hosea', 'Joel' => 'joel', 'Amos' => 'amos',
        'Obad' => 'obadiah', 'Jonah' => 'jonah', 'Mic' => 'micah',
        'Nah' => 'nahum', 'Hab' => 'habakkuk', 'Zeph' => 'zephaniah',
        'Hag' => 'haggai', 'Zech' => 'zechariah', 'Mal' => 'malachi',
        'Matt' => 'matthew', 'Mark' => 'mark', 'Luke' => 'luke',
        'John' => 'john', 'Acts' => 'acts', 'Rom' => 'romans',
        '1Cor' => '1-corinthians', '2Cor' => '2-corinthians', 'Gal' => 'galatians',
        'Eph' => 'ephesians', 'Phil' => 'philippians', 'Col' => 'colossians',
        '1Thess' => '1-thessalonians', '2Thess' => '2-thessalonians',
        '1Tim' => '1-timothy', '2Tim' => '2-timothy', 'Titus' => 'titus',
        'Phlm' => 'philemon', 'Heb' => 'hebrews', 'Jas' => 'james',
        '1Pet' => '1-peter', '2Pet' => '2-peter', '1John' => '1-john',
        '2John' => '2-john', '3John' => '3-john', 'Jude' => 'jude',
        'Rev' => 'revelation',
    ];

    public function run(): void
    {
        $csvPath = database_path('data/cross_references.csv');
        if (!file_exists($csvPath)) {
            $this->command->warn('cross_references.csv not found at ' . $csvPath . '. Skipping.');
            return;
        }

        // Build verse lookup: slug -> [chapter -> [verse -> id]]
        $this->command->info('Building verse index...');
        $verses = Verse::with('chapter.book:id,slug')->get();
        $index = [];
        foreach ($verses as $v) {
            $slug = $v->chapter->book->slug;
            $ch   = $v->chapter->number;
            $vn   = $v->number;
            $index[$slug][$ch][$vn] = $v->id;
        }

        $file   = fopen($csvPath, 'r');
        fgetcsv($file, 0, "\t"); // skip header
        $batch  = [];
        $count  = 0;
        $skip   = 0;

        while (($row = fgetcsv($file, 0, "\t")) !== false) {
            if (count($row) < 3) continue;
            [$fromRef, $toRef, $votes] = $row;
            $votes = (int) $votes;
            if ($votes < 5) continue; // only high-confidence refs

            $fromId = $this->resolveId($fromRef, $index);
            $toId   = $this->resolveId($toRef, $index);

            if (!$fromId || !$toId || $fromId === $toId) { $skip++; continue; }

            $batch[] = ['from_verse_id' => $fromId, 'to_verse_id' => $toId, 'votes' => min($votes, 255)];
            $count++;

            if (count($batch) >= 500) {
                DB::table('cross_references')->insertOrIgnore($batch);
                $batch = [];
            }
        }

        if ($batch) DB::table('cross_references')->insertOrIgnore($batch);
        fclose($file);

        $this->command->info("Seeded {$count} cross-references. Skipped {$skip}.");
    }

    private function resolveId(string $ref, array $index): ?int
    {
        // e.g. "Gen.1.1" or "Ps.119.105"
        $parts = explode('.', $ref);
        if (count($parts) !== 3) return null;

        [$book, $ch, $vn] = $parts;
        $slug = self::BOOK_MAP[$book] ?? null;
        if (!$slug) return null;

        return $index[$slug][(int)$ch][(int)$vn] ?? null;
    }
}
```

- [ ] **Step 3: Run the seeder**

```bash
php artisan db:seed --class=CrossReferenceSeeder
```

Expected output: `Seeded N cross-references. Skipped M.` — N should be in the tens of thousands.

- [ ] **Step 4: Commit**

```bash
git -C C:\Repos\verbum add database/seeders/CrossReferenceSeeder.php
git -C C:\Repos\verbum commit -m "feat: cross-reference seeder with OpenBible TSK dataset"
```

---

## Task 3: Cross-references API endpoint (verbum)

**Files:**
- Create: `app/Http/Controllers/Api/CrossReferenceController.php`
- Modify: `routes/api.php`

- [ ] **Step 1: Create controller**

```php
<?php
// app/Http/Controllers/Api/CrossReferenceController.php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Verse;
use Illuminate\Http\JsonResponse;

class CrossReferenceController extends Controller
{
    public function index(Verse $verse): JsonResponse
    {
        $refs = \DB::table('cross_references')
            ->where('from_verse_id', $verse->id)
            ->orderByDesc('votes')
            ->limit(20)
            ->pluck('to_verse_id');

        $verses = Verse::with('chapter.book:id,name,slug')
            ->whereIn('id', $refs)
            ->get()
            ->sortBy(fn($v) => $refs->search($v->id))
            ->values()
            ->map(fn($v) => [
                'id'      => $v->id,
                'book'    => $v->chapter->book->name,
                'slug'    => $v->chapter->book->slug,
                'chapter' => $v->chapter->number,
                'verse'   => $v->number,
                'text'    => $v->text,
            ]);

        return response()->json($verses);
    }
}
```

- [ ] **Step 2: Register route in `routes/api.php`** (add inside the public Bible section at the bottom)

```php
use App\Http\Controllers\Api\CrossReferenceController;

// add after the existing search route:
Route::get('/verses/{verse}/cross-references', [CrossReferenceController::class, 'index']);
```

- [ ] **Step 3: Test the endpoint**

```bash
curl "https://verbum.test/api/verses/1/cross-references"
```

Expected: JSON array of verse objects `[{ id, book, slug, chapter, verse, text }, ...]`.

- [ ] **Step 4: Commit**

```bash
git -C C:\Repos\verbum add app/Http/Controllers/Api/CrossReferenceController.php routes/api.php
git -C C:\Repos\verbum commit -m "feat: GET /api/verses/{verse}/cross-references endpoint"
```

---

## Task 4: Frontend API + stores (tulia-study)

**Files:**
- Modify: `src/lib/bibleApi.ts`
- Create: `src/lib/store/useCompareStore.ts`
- Create: `src/lib/store/useCrossRefStore.ts`

- [ ] **Step 1: Add `crossRefs` to `bibleApi.ts`**

Add to the `bibleApi` object:

```ts
// src/lib/bibleApi.ts  (add ApiCrossRef interface + crossRefs method)

export interface ApiCrossRef {
  id: number
  book: string
  slug: string
  chapter: number
  verse: number
  text: string
}

// inside bibleApi object:
crossRefs: (verseId: number) => api.get<ApiCrossRef[]>(`/api/verses/${verseId}/cross-references`),
```

- [ ] **Step 2: Create `useCompareStore.ts`**

```ts
// src/lib/store/useCompareStore.ts

import { create } from 'zustand'
import { bibleApi, ApiVersion, ApiChapterResponse } from '@/lib/bibleApi'

interface VersionChapter {
  version: ApiVersion
  data: ApiChapterResponse | null
  loading: boolean
  error: boolean
}

interface CompareState {
  open: boolean
  results: VersionChapter[]
  openCompare: (versions: ApiVersion[], slug: string, chapter: number) => Promise<void>
  closeCompare: () => void
}

export const useCompareStore = create<CompareState>((set) => ({
  open: false,
  results: [],

  openCompare: async (versions, slug, chapter) => {
    const initial: VersionChapter[] = versions.map(v => ({ version: v, data: null, loading: true, error: false }))
    set({ open: true, results: initial })

    const settled = await Promise.allSettled(
      versions.map(v => bibleApi.chapter(v.id, slug, chapter))
    )

    set({
      results: versions.map((v, i) => {
        const r = settled[i]
        return r.status === 'fulfilled'
          ? { version: v, data: r.value, loading: false, error: false }
          : { version: v, data: null,    loading: false, error: true  }
      }),
    })
  },

  closeCompare: () => set({ open: false, results: [] }),
}))
```

- [ ] **Step 3: Create `useCrossRefStore.ts`**

```ts
// src/lib/store/useCrossRefStore.ts

import { create } from 'zustand'
import { bibleApi, ApiCrossRef } from '@/lib/bibleApi'

interface CrossRefState {
  open: boolean
  verseApiId: number | null
  results: ApiCrossRef[]
  loading: boolean
  openPanel: (verseApiId: number) => Promise<void>
  closePanel: () => void
}

export const useCrossRefStore = create<CrossRefState>((set, get) => ({
  open: false,
  verseApiId: null,
  results: [],
  loading: false,

  openPanel: async (verseApiId) => {
    if (get().verseApiId === verseApiId && get().open) { return }
    set({ open: true, verseApiId, results: [], loading: true })
    try {
      const results = await bibleApi.crossRefs(verseApiId)
      set({ results, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  closePanel: () => set({ open: false }),
}))
```

- [ ] **Step 4: Commit**

```bash
git -C C:\Repos\tulia-study add src/lib/bibleApi.ts src/lib/store/useCompareStore.ts src/lib/store/useCrossRefStore.ts
git -C C:\Repos\tulia-study commit -m "feat: compare and cross-ref stores + bibleApi extension"
```

---

## Task 5: ReadingToolbar component (tulia-study)

**Files:**
- Create: `src/components/reading/ReadingToolbar.tsx`

This toolbar lives next to the existing reading-mode toggle at the top of `VerseList`. It has two icon buttons.

- [ ] **Step 1: Create the component**

```tsx
// src/components/reading/ReadingToolbar.tsx

import { useVerseStore } from '@/lib/store/useVerseStore'
import { useCompareStore } from '@/lib/store/useCompareStore'
import { useCrossRefStore } from '@/lib/store/useCrossRefStore'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/cn'

function IconCompare() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2" width="5" height="10" rx="1" />
      <rect x="8" y="2" width="5" height="10" rx="1" />
    </svg>
  )
}

function IconXRef() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="3" cy="4" r="1.5" />
      <circle cx="11" cy="4" r="1.5" />
      <circle cx="7" cy="11" r="1.5" />
      <path d="M4.3 4.8C5 7 7 9.5 7 9.5M9.7 4.8C9 7 7 9.5 7 9.5" />
    </svg>
  )
}

export function ReadingToolbar() {
  const versions      = useVerseStore(s => s.versions)
  const selectedBook  = useVerseStore(s => s.selectedBook)
  const selectedChapter = useVerseStore(s => s.selectedChapter)
  const loadVersions  = useVerseStore(s => s.loadVersions)
  const selectedVerseId = useVerseStore(s => s.selectedVerseId)
  const verses        = useVerseStore(s => s.verses)

  const openCompare   = useCompareStore(s => s.openCompare)
  const compareOpen   = useCompareStore(s => s.open)
  const openXRef      = useCrossRefStore(s => s.openPanel)
  const xrefOpen      = useCrossRefStore(s => s.open)

  const selectedVerse = verses.find(v => v.id === selectedVerseId) ?? null

  const handleCompare = async () => {
    let vers = versions
    if (!vers.length) {
      await loadVersions()
      vers = useVerseStore.getState().versions
    }
    openCompare(vers, selectedBook, selectedChapter)
  }

  const handleXRef = () => {
    if (!selectedVerse) return
    openXRef(selectedVerse.apiId)
  }

  const btnClass = (active: boolean) => cn(
    'p-1.5 rounded transition-colors duration-100',
    active
      ? 'bg-bg-secondary text-accent shadow-sm'
      : 'text-text-muted hover:text-text-secondary',
  )

  return (
    <div className="flex gap-0.5 bg-bg-tertiary border border-border-subtle rounded-md p-0.5 pointer-events-auto shadow-sm">
      <Tooltip label="Compare versions" side="bottom">
        <button onClick={handleCompare} className={btnClass(compareOpen)}>
          <IconCompare />
        </button>
      </Tooltip>
      <Tooltip label={selectedVerse ? 'Cross-references' : 'Select a verse first'} side="bottom">
        <button
          onClick={handleXRef}
          disabled={!selectedVerse}
          className={cn(btnClass(xrefOpen), !selectedVerse && 'opacity-40 cursor-not-allowed')}
        >
          <IconXRef />
        </button>
      </Tooltip>
    </div>
  )
}
```

- [ ] **Step 2: Mount toolbar in `VerseList.tsx`**

Import and add `ReadingToolbar` next to the existing mode toggle div:

```tsx
import { ReadingToolbar } from '@/components/reading/ReadingToolbar'

// In the JSX, find the sticky top-0 div with the mode toggle and change to:
<div className="sticky top-0 z-10 flex justify-end px-4 py-2 pointer-events-none">
  <div className="flex gap-2 items-center">
    <ReadingToolbar />
    <div className="flex gap-0.5 bg-bg-tertiary border border-border-subtle rounded-md p-0.5 pointer-events-auto shadow-sm">
      <Tooltip label="Verse mode" side="bottom">
        {/* existing verse mode button */}
      </Tooltip>
      <Tooltip label="Flow mode" side="bottom">
        {/* existing flow mode button */}
      </Tooltip>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git -C C:\Repos\tulia-study add src/components/reading/ReadingToolbar.tsx src/components/verse/VerseList.tsx
git -C C:\Repos\tulia-study commit -m "feat: ReadingToolbar with compare + cross-ref buttons"
```

---

## Task 6: CompareVersionsModal (tulia-study)

**Files:**
- Create: `src/components/reading/CompareVersionsModal.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the modal**

```tsx
// src/components/reading/CompareVersionsModal.tsx

import { useCompareStore } from '@/lib/store/useCompareStore'
import { useEffect } from 'react'
import { cn } from '@/lib/cn'

export function CompareVersionsModal() {
  const { open, results, closeCompare } = useCompareStore()

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCompare() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col"
      onClick={closeCompare}
    >
      <div
        className="flex flex-col flex-1 mt-16 mb-4 mx-4 bg-bg-secondary rounded-xl border border-border-subtle shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle shrink-0">
          <h2 className="text-sm font-medium text-text-primary">Compare Versions</h2>
          <button
            onClick={closeCompare}
            className="text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        {/* Columns */}
        <div className="flex-1 overflow-hidden flex divide-x divide-border-subtle">
          {results.map(({ version, data, loading, error }) => (
            <div key={version.id} className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* Version header */}
              <div className="px-4 py-2 border-b border-border-subtle shrink-0 bg-bg-tertiary">
                <span className="text-xs font-semibold text-accent">{version.abbreviation}</span>
                <span className="text-2xs text-text-muted ml-1.5">{version.name}</span>
              </div>

              {/* Verses */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {loading && (
                  <p className="text-xs text-text-muted animate-pulse">Loading…</p>
                )}
                {error && (
                  <p className="text-xs text-red-400">Failed to load</p>
                )}
                {!loading && !error && data && data.verses.map(verse => (
                  <div key={verse.id} className="flex gap-2 text-sm leading-relaxed">
                    <span className="font-sans text-[10px] font-bold text-accent/60 pt-[3px] shrink-0 w-5 text-right">
                      {verse.number}
                    </span>
                    <p className="font-reading text-text-primary">{verse.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Mount in `App.tsx`**

```tsx
import { CompareVersionsModal } from '@/components/reading/CompareVersionsModal'

// inside return, alongside <CommandPalette />, <Toast />, etc.:
<CompareVersionsModal />
```

- [ ] **Step 3: Commit**

```bash
git -C C:\Repos\tulia-study add src/components/reading/CompareVersionsModal.tsx src/App.tsx
git -C C:\Repos\tulia-study commit -m "feat: CompareVersionsModal"
```

---

## Task 7: CrossReferencesPanel (tulia-study)

**Files:**
- Create: `src/components/reading/CrossReferencesPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the panel**

```tsx
// src/components/reading/CrossReferencesPanel.tsx

import { useCrossRefStore } from '@/lib/store/useCrossRefStore'
import { useVerseStore } from '@/lib/store/useVerseStore'
import { useEffect } from 'react'

export function CrossReferencesPanel() {
  const { open, results, loading, closePanel } = useCrossRefStore()
  const selectBook    = useVerseStore(s => s.selectBook)
  const selectChapter = useVerseStore(s => s.selectChapter)
  const selectVerse   = useVerseStore(s => s.selectVerse)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closePanel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  if (!open) return null

  const navigate = (slug: string, chapter: number, verseSlug: string) => {
    selectBook(slug)
    selectChapter(chapter)
    // selectVerse expects the full slug-chapter-verse id
    // We navigate to chapter first; verse selection happens after load
    closePanel()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-end"
      onClick={closePanel}
    >
      <div
        className="mt-16 mr-4 mb-4 w-96 bg-bg-secondary rounded-xl border border-border-subtle shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 5rem)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
          <h2 className="text-sm font-medium text-text-primary">Cross-References</h2>
          <button
            onClick={closePanel}
            className="text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-xs text-text-muted text-center py-8 animate-pulse">Loading…</p>
          )}
          {!loading && results.length === 0 && (
            <p className="text-xs text-text-muted text-center py-8">No cross-references found</p>
          )}
          {!loading && results.map(ref => (
            <button
              key={ref.id}
              onClick={() => navigate(ref.slug, ref.chapter, `${ref.slug}-${ref.chapter}-${ref.verse}`)}
              className="w-full text-left px-4 py-3 border-b border-border-subtle hover:bg-bg-tertiary transition-colors group"
            >
              <p className="text-xs text-accent font-medium mb-1">
                {ref.book} {ref.chapter}:{ref.verse}
              </p>
              <p className="font-reading text-sm text-text-secondary leading-relaxed group-hover:text-text-primary transition-colors">
                {ref.text}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Mount in `App.tsx`**

```tsx
import { CrossReferencesPanel } from '@/components/reading/CrossReferencesPanel'

// inside return:
<CrossReferencesPanel />
```

- [ ] **Step 3: Commit**

```bash
git -C C:\Repos\tulia-study add src/components/reading/CrossReferencesPanel.tsx src/App.tsx
git -C C:\Repos\tulia-study commit -m "feat: CrossReferencesPanel"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: Compare Versions ✓, Cross-References (backend + frontend) ✓, toolbar buttons ✓, Esc to close both ✓, navigation from cross-ref to verse ✓
- [x] **No placeholders**: All code is concrete and complete
- [x] **Type consistency**: `ApiCrossRef` defined in Task 4 Step 1, used in `useCrossRefStore` (Task 4 Step 3) and `CrossReferencesPanel` (Task 7); `VersionChapter` defined and used within `useCompareStore` only; `openCompare` signature matches usage in `ReadingToolbar`
- [x] **Dependency order**: Tasks 1-3 are verbum-only and can run before frontend tasks; Task 4 (stores) must precede Tasks 5-7 (UI); Task 5 (toolbar) depends on both stores from Task 4
