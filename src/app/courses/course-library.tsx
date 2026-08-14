"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Cuboid,
  Flag,
  Grid2X2,
  Heart,
  List,
  MapPin,
  MapPinned,
  Search,
  SlidersHorizontal,
  Target,
  Trophy,
  X,
} from "lucide-react";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useCourseFavourites } from "@/app/courses/use-course-favourites";

export type CourseLibraryEntry = {
  id: string;
  name: string;
  country: string | null;
  location: string;
  latitude: number | null;
  longitude: number | null;
  mapPreviewAvailable: boolean;
  previewImageUrl: string | null;
  holeCount: number;
  roundCount: number;
  lastPlayedAt: string | null;
  recordCount: number;
  strategyReady: boolean;
  courseTwinReady: boolean;
  courseTwinGrade: string | null;
  favourite: boolean;
};

type LibraryFilter = "played" | "favourite" | "twin" | "strategy" | "records";

export function CourseLibrary({
  courses,
  initialFilter = "",
  initialQuery = "",
  initialView = "grid",
}: {
  courses: CourseLibraryEntry[];
  initialFilter?: string;
  initialQuery?: string;
  initialView?: "grid" | "table";
}) {
  const [query, setQuery] = useState(initialQuery);
  const [view, setView] = useState<"grid" | "table">(initialView);
  const [location, setLocation] = useState("all");
  const [filters, setFilters] = useState<Set<LibraryFilter>>(() => initialFilters(initialFilter));
  const {
    favourites,
    isPending: favouritePending,
    toggleFavourite,
  } = useCourseFavourites(courses.filter((course) => course.favourite).map((course) => course.id));

  const locations = useMemo(
    () =>
      [...new Set(courses.map((course) => course.country).filter(Boolean) as string[])].sort(
        (left, right) => left.localeCompare(right),
      ),
    [courses],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCourses = useMemo(
    () =>
      courses.filter((course) => {
        if (
          normalizedQuery &&
          ![course.name, course.location, course.country]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(normalizedQuery))
        ) {
          return false;
        }
        if (location !== "all" && course.country !== location) return false;
        if (filters.has("played") && course.roundCount === 0) return false;
        if (filters.has("favourite") && !favourites.has(course.id)) return false;
        if (filters.has("twin") && !course.courseTwinReady) return false;
        if (filters.has("strategy") && !course.strategyReady) return false;
        if (filters.has("records") && course.recordCount === 0) return false;
        return true;
      }),
    [courses, favourites, filters, location, normalizedQuery],
  );
  const playedCount = courses.filter((course) => course.roundCount > 0).length;
  const activeFilterCount = filters.size + (location === "all" ? 0 : 1);
  const hasSearchOrFilters = Boolean(normalizedQuery || activeFilterCount);

  function toggleFilter(filter: LibraryFilter) {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setLocation("all");
    setFilters(new Set());
  }

  return (
    <section className="grid gap-5" data-course-library>
      <div className="grid gap-3 rounded-xl border bg-card p-3 shadow-sm lg:grid-cols-[minmax(280px,1fr)_auto] lg:items-center">
        <InputGroup className="h-11 bg-background lg:max-w-xl">
          <InputGroupAddon>
            <Search className="size-4" aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search courses, towns or countries"
            aria-label="Search courses"
          />
          {query ? (
            <InputGroupAddon align="inline-end">
              <button
                type="button"
                onClick={() => setQuery("")}
                className="focus-aaa rounded-md p-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear course search"
              >
                <X className="size-4" aria-hidden />
              </button>
            </InputGroupAddon>
          ) : null}
        </InputGroup>

        <div className="flex items-center justify-between gap-2 lg:justify-end">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <span className="font-semibold text-foreground">{filteredCourses.length}</span> of{" "}
            {courses.length} courses
          </p>
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 lg:hidden">
                <SlidersHorizontal className="size-4" aria-hidden />
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Filter courses</DrawerTitle>
                <DrawerDescription>
                  Narrow the library by playing history, readiness or location.
                </DrawerDescription>
              </DrawerHeader>
              <div className="grid grid-cols-2 gap-2 overflow-y-auto px-4 pb-2">
                <FilterButton
                  active={filters.has("played")}
                  icon={Flag}
                  label="Played"
                  onClick={() => toggleFilter("played")}
                />
                <FilterButton
                  active={filters.has("favourite")}
                  icon={Heart}
                  label="Favourite"
                  onClick={() => toggleFilter("favourite")}
                />
                <FilterButton
                  active={filters.has("twin")}
                  icon={Cuboid}
                  label="Course Twin"
                  onClick={() => toggleFilter("twin")}
                />
                <FilterButton
                  active={filters.has("strategy")}
                  icon={Target}
                  label="Strategy"
                  onClick={() => toggleFilter("strategy")}
                />
                <FilterButton
                  active={filters.has("records")}
                  icon={Trophy}
                  label="Records"
                  onClick={() => toggleFilter("records")}
                />
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger
                    className="h-9 w-full bg-background"
                    aria-label="Filter by location"
                  >
                    <MapPin className="size-4 text-muted-foreground" aria-hidden />
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {locations.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DrawerFooter>
                {activeFilterCount > 0 ? (
                  <Button variant="ghost" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : null}
                <DrawerClose asChild>
                  <Button>Show {filteredCourses.length} courses</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(next) => {
              if (next === "grid" || next === "table") setView(next);
            }}
            variant="outline"
            spacing={0}
            aria-label="Course library view"
          >
            <ToggleGroupItem value="grid" aria-label="Grid view" className="min-h-9 px-3">
              <Grid2X2 className="size-4" aria-hidden />
              <span className="hidden sm:inline">Grid</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view" className="min-h-9 px-3">
              <List className="size-4" aria-hidden />
              <span className="hidden sm:inline">Table</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="hidden flex-wrap items-center gap-2 lg:col-span-2 lg:flex">
          <FilterButton
            active={filters.has("played")}
            icon={Flag}
            label="Played"
            onClick={() => toggleFilter("played")}
          />
          <FilterButton
            active={filters.has("favourite")}
            icon={Heart}
            label="Favourite"
            onClick={() => toggleFilter("favourite")}
          />
          <FilterButton
            active={filters.has("twin")}
            icon={Cuboid}
            label="Course Twin"
            onClick={() => toggleFilter("twin")}
          />
          <FilterButton
            active={filters.has("strategy")}
            icon={Target}
            label="Strategy ready"
            onClick={() => toggleFilter("strategy")}
          />
          <FilterButton
            active={filters.has("records")}
            icon={Trophy}
            label="Records"
            onClick={() => toggleFilter("records")}
          />
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger className="h-9 min-w-36 bg-background" aria-label="Filter by location">
              <MapPin className="size-4 text-muted-foreground" aria-hidden />
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeFilterCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Courses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {playedCount} played · {favourites.size} saved as favourite
          </p>
        </div>
      </div>

      {filteredCourses.length === 0 ? (
        <AppEmptyState
          icon={<MapPinned className="size-5" aria-hidden />}
          title={hasSearchOrFilters ? "No courses match this view" : "No courses to show"}
          description={
            filters.has("favourite") && favourites.size === 0
              ? "Favourite a course from the library, then it will appear in this saved account view."
              : "Try another course name, location or readiness filter."
          }
          primaryAction={
            <Button type="button" onClick={clearFilters}>
              Clear search and filters
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline">
              <Link href="/courses/new">Add course</Link>
            </Button>
          }
          className="min-h-[360px]"
        />
      ) : view === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-course-grid>
          {filteredCourses.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              favourite={favourites.has(course.id)}
              onFavourite={() => toggleFavourite(course.id)}
              favouritePending={favouritePending}
              priority={index < 3}
            />
          ))}
        </div>
      ) : (
        <CourseTable
          courses={filteredCourses}
          favourites={favourites}
          favouritePending={favouritePending}
          onFavourite={toggleFavourite}
        />
      )}
    </section>
  );
}

function FilterButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Flag;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "outline"}
      size="sm"
      className={cn("h-9", active && "border-primary/25 text-primary")}
      aria-pressed={active}
      onClick={onClick}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </Button>
  );
}

function CourseCard({
  course,
  favourite,
  onFavourite,
  favouritePending,
  priority,
}: {
  course: CourseLibraryEntry;
  favourite: boolean;
  onFavourite: () => void;
  favouritePending: boolean;
  priority: boolean;
}) {
  return (
    <Card className="group overflow-hidden py-0 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg motion-reduce:transform-none">
      <div className="relative">
        <Link href={`/courses/${course.id}`} aria-label={`View ${course.name}`}>
          <CoursePreview course={course} priority={priority} className="h-44" />
        </Link>
        <button
          type="button"
          onClick={onFavourite}
          disabled={favouritePending}
          className={cn(
            "focus-aaa absolute right-3 top-3 grid size-10 place-items-center rounded-full border border-white/50 bg-background/90 text-foreground shadow-sm backdrop-blur transition-colors",
            favourite && "bg-primary text-primary-foreground",
          )}
          aria-label={
            favourite ? `Remove ${course.name} from favourites` : `Favourite ${course.name}`
          }
          aria-pressed={favourite}
        >
          <Heart className={cn("size-4", favourite && "fill-current")} aria-hidden />
        </button>
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <span className="rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur">
            {course.holeCount > 0 ? `${course.holeCount} holes` : "Course details building"}
          </span>
          {course.roundCount > 0 ? (
            <span className="rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur">
              {course.roundCount} {course.roundCount === 1 ? "round" : "rounds"}
            </span>
          ) : null}
        </div>
      </div>

      <CardContent className="grid gap-4 p-4">
        <div>
          <Link
            href={`/courses/${course.id}`}
            className="focus-aaa line-clamp-2 font-display text-xl font-semibold leading-tight text-foreground underline-offset-4 group-hover:underline"
          >
            {course.name}
          </Link>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-1">{course.location}</span>
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 border-y border-border/70 py-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Last played</dt>
            <dd className="mt-1 font-medium text-foreground">
              {formatLastPlayed(course.lastPlayedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Records</dt>
            <dd className="mt-1 font-medium text-foreground">
              {course.recordCount > 0 ? `${course.recordCount} available` : "None yet"}
            </dd>
          </div>
        </dl>

        {course.strategyReady || course.courseTwinReady ? (
          <div className="flex flex-wrap gap-2" aria-label="Available course features">
            {course.strategyReady ? <CapabilityBadge icon={Target} label="Strategy ready" /> : null}
            {course.courseTwinReady ? (
              <CapabilityBadge
                icon={Cuboid}
                label={
                  course.courseTwinGrade
                    ? `Course Twin · ${course.courseTwinGrade}`
                    : "Course Twin ready"
                }
              />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CapabilityBadge({ icon: Icon, label }: { icon: typeof Target; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/8 px-2 py-1 text-xs font-medium text-primary">
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

function CourseTable({
  courses,
  favourites,
  favouritePending,
  onFavourite,
}: {
  courses: CourseLibraryEntry[];
  favourites: Set<string>;
  favouritePending: boolean;
  onFavourite: (courseId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm" data-course-table>
      <div className="overflow-x-auto">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>Course</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Holes</TableHead>
              <TableHead>Last played</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead>Course Twin</TableHead>
              <TableHead className="text-right">Records</TableHead>
              <TableHead className="w-12 text-center">Favourite</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((course) => {
              const favourite = favourites.has(course.id);
              return (
                <TableRow key={course.id} className="h-16">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CoursePreview course={course} className="h-10 w-16 shrink-0 rounded-md" />
                      <Link
                        href={`/courses/${course.id}`}
                        className="focus-aaa max-w-64 truncate font-semibold text-foreground underline-offset-4 hover:underline"
                      >
                        {course.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-52 truncate text-muted-foreground">
                    {course.location}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {course.holeCount || "—"}
                  </TableCell>
                  <TableCell>{formatLastPlayed(course.lastPlayedAt)}</TableCell>
                  <TableCell>
                    <CompactStatus ready={course.strategyReady} label="Ready" />
                  </TableCell>
                  <TableCell>
                    <CompactStatus
                      ready={course.courseTwinReady}
                      label={course.courseTwinGrade ? `Grade ${course.courseTwinGrade}` : "Ready"}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{course.recordCount}</TableCell>
                  <TableCell className="text-center">
                    <button
                      type="button"
                      onClick={() => onFavourite(course.id)}
                      disabled={favouritePending}
                      className={cn(
                        "focus-aaa inline-grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
                        favourite && "text-primary",
                      )}
                      aria-label={
                        favourite
                          ? `Remove ${course.name} from favourites`
                          : `Favourite ${course.name}`
                      }
                      aria-pressed={favourite}
                    >
                      <Heart className={cn("size-4", favourite && "fill-current")} aria-hidden />
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/courses/${course.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CompactStatus({ ready, label }: { ready: boolean; label: string }) {
  if (!ready) {
    return (
      <span className="text-muted-foreground" aria-label="Unavailable">
        —
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
      <CheckCircle2 className="size-4 text-primary" aria-hidden />
      <span className="font-medium text-foreground">{label}</span>
    </span>
  );
}

export function CoursePreview({
  course,
  className,
  priority = false,
}: {
  course: Pick<
    CourseLibraryEntry,
    "id" | "name" | "latitude" | "longitude" | "mapPreviewAvailable" | "previewImageUrl"
  >;
  className?: string;
  priority?: boolean;
}) {
  const [aerialFailed, setAerialFailed] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const aerialSrc = course.previewImageUrl?.trim() || null;
  const hasAerial = Boolean(aerialSrc && !aerialFailed);
  const hasMap =
    !hasAerial &&
    course.mapPreviewAvailable &&
    course.latitude !== null &&
    course.longitude !== null &&
    !mapFailed;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[linear-gradient(135deg,var(--muted),color-mix(in_srgb,var(--primary)_14%,var(--muted)))]",
        className,
      )}
    >
      {hasAerial ? (
        <Image
          src={aerialSrc!}
          alt={`Aerial view of ${course.name}`}
          fill
          unoptimized
          priority={priority}
          sizes="(min-width: 1536px) 24vw, (min-width: 1280px) 32vw, (min-width: 768px) 48vw, 100vw"
          className="object-cover saturate-[0.92] contrast-[1.04] transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
          onError={() => setAerialFailed(true)}
        />
      ) : hasMap ? (
        <Image
          src={`/api/courses/google/map?lat=${course.latitude}&lng=${course.longitude}&width=720&height=400&zoom=15`}
          alt={`Map preview of ${course.name}`}
          fill
          unoptimized
          priority={priority}
          sizes="(min-width: 1536px) 24vw, (min-width: 1280px) 32vw, (min-width: 768px) 48vw, 100vw"
          className="object-cover saturate-[0.88] transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
          onError={() => setMapFailed(true)}
        />
      ) : (
        <>
          <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_24%_34%,color-mix(in_srgb,var(--primary)_40%,transparent)_0_2px,transparent_3px),linear-gradient(122deg,transparent_42%,color-mix(in_srgb,var(--primary)_35%,transparent)_43%_45%,transparent_46%),linear-gradient(28deg,transparent_54%,color-mix(in_srgb,var(--primary)_22%,transparent)_55%_57%,transparent_58%)]" />
          <div className="absolute inset-0 grid place-items-center">
            <MapPinned className="size-9 text-primary/55" aria-hidden />
          </div>
        </>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/5" />
    </div>
  );
}

function formatLastPlayed(value: string | null) {
  if (!value) return "Not played yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function initialFilters(value: string) {
  const filters = new Set<LibraryFilter>();
  if (value === "played") filters.add("played");
  if (value === "favourites") filters.add("favourite");
  if (value === "patterns" || value === "strategy") filters.add("strategy");
  if (value === "records") filters.add("records");
  if (value === "course-twin") filters.add("twin");
  return filters;
}
