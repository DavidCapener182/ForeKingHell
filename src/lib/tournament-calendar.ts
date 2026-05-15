import type { TournamentFormat } from "@/lib/tournaments";

export type ScheduledCourse = {
  name: string;
  country: string;
};

export type ScheduledTournamentKind = "daily" | "weekly" | "monthly";

export type ScheduledTournament = {
  key: string;
  kind: ScheduledTournamentKind;
  title: string;
  eyebrow: string;
  description: string;
  course: ScheduledCourse;
  startsAt: Date;
  endsAt: Date;
  format: TournamentFormat;
  roundCount: number;
  verificationPolicy: "gold" | "silver";
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const popularDailyCourses: ScheduledCourse[] = [
  { name: "Augusta National Golf Club", country: "USA" },
  { name: "The Old Course at St Andrews", country: "Scotland" },
  { name: "Pebble Beach Golf Links", country: "USA" },
  { name: "TPC Sawgrass - Stadium Course", country: "USA" },
  { name: "Pinehurst No. 2", country: "USA" },
  { name: "Bethpage Black", country: "USA" },
  { name: "Oakmont Country Club", country: "USA" },
  { name: "Royal County Down", country: "Northern Ireland" },
  { name: "Royal Melbourne West", country: "Australia" },
  { name: "Royal Portrush - Dunluce", country: "Northern Ireland" },
  { name: "Carnoustie Golf Links - Championship", country: "Scotland" },
  { name: "Muirfield", country: "Scotland" },
  { name: "Royal Birkdale", country: "England" },
  { name: "Royal St George's", country: "England" },
  { name: "Royal Liverpool - Hoylake", country: "England" },
  { name: "Royal Troon - Old Course", country: "Scotland" },
  { name: "Turnberry - Ailsa", country: "Scotland" },
  { name: "Shinnecock Hills Golf Club", country: "USA" },
  { name: "Winged Foot West", country: "USA" },
  { name: "Merion Golf Club - East", country: "USA" },
  { name: "Riviera Country Club", country: "USA" },
  { name: "Torrey Pines South", country: "USA" },
  { name: "Quail Hollow Club", country: "USA" },
  { name: "Harbour Town Golf Links", country: "USA" },
  { name: "Muirfield Village Golf Club", country: "USA" },
  { name: "East Lake Golf Club", country: "USA" },
  { name: "Valhalla Golf Club", country: "USA" },
  { name: "Southern Hills Country Club", country: "USA" },
  { name: "Medinah No. 3", country: "USA" },
  { name: "Kiawah Island - Ocean Course", country: "USA" },
  { name: "Whistling Straits - Straits", country: "USA" },
  { name: "Erin Hills", country: "USA" },
  { name: "Chambers Bay", country: "USA" },
  { name: "Congressional Blue", country: "USA" },
  { name: "Olympic Club - Lake", country: "USA" },
  { name: "Los Angeles Country Club - North", country: "USA" },
  { name: "The Country Club - Brookline", country: "USA" },
  { name: "Baltusrol Lower", country: "USA" },
  { name: "Inverness Club", country: "USA" },
  { name: "Oakland Hills South", country: "USA" },
  { name: "Colonial Country Club", country: "USA" },
  { name: "Firestone South", country: "USA" },
  { name: "Crooked Stick Golf Club", country: "USA" },
  { name: "Hazeltine National", country: "USA" },
  { name: "TPC Scottsdale - Stadium", country: "USA" },
  { name: "TPC River Highlands", country: "USA" },
  { name: "TPC Deere Run", country: "USA" },
  { name: "TPC Summerlin", country: "USA" },
  { name: "Bay Hill Club and Lodge", country: "USA" },
  { name: "PGA National - Champion", country: "USA" },
  { name: "Doral - Blue Monster", country: "USA" },
  { name: "Liberty National", country: "USA" },
  { name: "Shadow Creek", country: "USA" },
  { name: "Wolf Creek Golf Club", country: "USA" },
  { name: "Pasatiempo Golf Club", country: "USA" },
  { name: "Spyglass Hill", country: "USA" },
  { name: "Kapalua - Plantation", country: "USA" },
  { name: "Waialae Country Club", country: "USA" },
  { name: "Sunningdale Old", country: "England" },
  { name: "Sunningdale New", country: "England" },
  { name: "Wentworth West", country: "England" },
  { name: "Walton Heath Old", country: "England" },
  { name: "Woodhall Spa - Hotchkin", country: "England" },
  { name: "North Berwick West Links", country: "Scotland" },
  { name: "Royal Dornoch - Championship", country: "Scotland" },
  { name: "Kingsbarns Golf Links", country: "Scotland" },
  { name: "Gleneagles - PGA Centenary", country: "Scotland" },
  { name: "Castle Stuart", country: "Scotland" },
  { name: "Prestwick Golf Club", country: "Scotland" },
  { name: "Ballybunion Old", country: "Ireland" },
  { name: "Lahinch Old", country: "Ireland" },
  { name: "Portmarnock Golf Club", country: "Ireland" },
  { name: "Adare Manor", country: "Ireland" },
  { name: "The K Club", country: "Ireland" },
  { name: "Le Golf National - Albatros", country: "France" },
  { name: "Real Club Valderrama", country: "Spain" },
  { name: "Real Club de Sotogrande", country: "Spain" },
  { name: "PGA Catalunya - Stadium", country: "Spain" },
  { name: "Finca Cortesin", country: "Spain" },
  { name: "Marco Simone Golf and Country Club", country: "Italy" },
  { name: "Crans-sur-Sierre", country: "Switzerland" },
  { name: "Bernardus Golf", country: "Netherlands" },
  { name: "The International Amsterdam", country: "Netherlands" },
  { name: "Bro Hof Slott - Stadium", country: "Sweden" },
  { name: "Halmstad North", country: "Sweden" },
  { name: "Lofoten Links", country: "Norway" },
  { name: "Royal Hague", country: "Netherlands" },
  { name: "Kennemer Golf and Country Club", country: "Netherlands" },
  { name: "Albatross Golf Resort", country: "Czech Republic" },
  { name: "Royal Melbourne East", country: "Australia" },
  { name: "Kingston Heath", country: "Australia" },
  { name: "Barnbougle Dunes", country: "Australia" },
  { name: "Barnbougle Lost Farm", country: "Australia" },
  { name: "Cape Wickham Links", country: "Australia" },
  { name: "New South Wales Golf Club", country: "Australia" },
  { name: "Metropolitan Golf Club", country: "Australia" },
  { name: "Victoria Golf Club", country: "Australia" },
  { name: "Ellerston Golf Course", country: "Australia" },
  { name: "Tara Iti", country: "New Zealand" },
  { name: "Cape Kidnappers", country: "New Zealand" },
  { name: "Kauri Cliffs", country: "New Zealand" },
  { name: "Jacks Point", country: "New Zealand" },
  { name: "Paraparaumu Beach", country: "New Zealand" },
  { name: "Hirono Golf Club", country: "Japan" },
  { name: "Kawana Hotel - Fuji", country: "Japan" },
  { name: "Kasumigaseki East", country: "Japan" },
  { name: "Naruo Golf Club", country: "Japan" },
  { name: "Tokyo Golf Club", country: "Japan" },
  { name: "Nine Bridges", country: "South Korea" },
  { name: "Jack Nicklaus Golf Club Korea", country: "South Korea" },
  { name: "Anyang Country Club", country: "South Korea" },
  { name: "Shanqin Bay", country: "China" },
  { name: "Mission Hills - World Cup", country: "China" },
  { name: "Sentosa - Serapong", country: "Singapore" },
  { name: "Laguna National - Masters", country: "Singapore" },
  { name: "Thai Country Club", country: "Thailand" },
  { name: "Amata Spring", country: "Thailand" },
  { name: "Emirates Golf Club - Majlis", country: "UAE" },
  { name: "Yas Links Abu Dhabi", country: "UAE" },
  { name: "Doha Golf Club", country: "Qatar" },
  { name: "Royal Golf Dar Es Salam - Red", country: "Morocco" },
  { name: "Leopard Creek", country: "South Africa" },
  { name: "Gary Player Country Club", country: "South Africa" },
  { name: "Fancourt - The Links", country: "South Africa" },
  { name: "Fancourt - Montagu", country: "South Africa" },
  { name: "Durban Country Club", country: "South Africa" },
  { name: "Arabella Golf Club", country: "South Africa" },
  { name: "Jockey Club - Red", country: "Argentina" },
  { name: "Olivos Golf Club", country: "Argentina" },
  { name: "Buenos Aires Golf Club", country: "Argentina" },
  { name: "Rio Olympic Golf Course", country: "Brazil" },
  { name: "Terravista Golf Course", country: "Brazil" },
  { name: "Teeth of the Dog", country: "Dominican Republic" },
  { name: "Casa de Campo - Dye Fore", country: "Dominican Republic" },
  { name: "Punta Espada", country: "Dominican Republic" },
  { name: "El Camaleon Mayakoba", country: "Mexico" },
  { name: "Diamante - Dunes", country: "Mexico" },
  { name: "Cabo del Sol - Cove Club", country: "Mexico" },
  { name: "Royal Montreal - Blue", country: "Canada" },
  { name: "Hamilton Golf and Country Club", country: "Canada" },
  { name: "St George's Golf and Country Club", country: "Canada" },
  { name: "Cabot Cliffs", country: "Canada" },
  { name: "Cabot Links", country: "Canada" },
  { name: "Banff Springs", country: "Canada" },
  { name: "Jasper Park Lodge", country: "Canada" },
  { name: "Bandon Dunes", country: "USA" },
  { name: "Pacific Dunes", country: "USA" },
  { name: "Bandon Trails", country: "USA" },
  { name: "Old Macdonald", country: "USA" },
  { name: "Sand Hills Golf Club", country: "USA" },
  { name: "Ballyneal", country: "USA" },
  { name: "Streamsong Red", country: "USA" },
  { name: "Streamsong Blue", country: "USA" },
  { name: "Streamsong Black", country: "USA" },
  { name: "Seminole Golf Club", country: "USA" },
  { name: "Pine Valley Golf Club", country: "USA" },
  { name: "Cypress Point Club", country: "USA" },
  { name: "National Golf Links of America", country: "USA" },
  { name: "Friar's Head", country: "USA" },
  { name: "Chicago Golf Club", country: "USA" },
  { name: "Prairie Dunes", country: "USA" },
  { name: "Crystal Downs", country: "USA" },
  { name: "Peachtree Golf Club", country: "USA" },
  { name: "Caves Valley Golf Club", country: "USA" },
  { name: "Bellerive Country Club", country: "USA" },
  { name: "Aronimink Golf Club", country: "USA" },
  { name: "The Greenbrier - Old White", country: "USA" },
  { name: "Sea Island - Seaside", country: "USA" },
  { name: "Sedgefield Country Club", country: "USA" },
  { name: "Detroit Golf Club", country: "USA" },
  { name: "Memorial Park Golf Course", country: "USA" },
  { name: "Vidanta Vallarta", country: "Mexico" },
];

const fillerRegions = [
  "Alpine",
  "Andes",
  "Atlantic",
  "Baltic",
  "Bay",
  "Cape",
  "Coastal",
  "Desert",
  "Dunes",
  "Forest",
  "Harbour",
  "Highland",
  "Island",
  "Lakes",
  "Links",
  "Mountain",
  "Ocean",
  "Pacific",
  "Prairie",
  "River",
  "Royal",
  "Sandbelt",
  "Seaside",
  "Valley",
  "Volcanic",
];

const fillerCountries = [
  "Portugal",
  "Germany",
  "Denmark",
  "Finland",
  "Iceland",
  "Poland",
  "Austria",
  "Turkey",
  "Greece",
  "India",
  "Malaysia",
  "Indonesia",
  "Vietnam",
  "Philippines",
  "Taiwan",
  "Chile",
  "Colombia",
  "Peru",
  "Uruguay",
  "Costa Rica",
  "Panama",
  "Jamaica",
  "Egypt",
  "Kenya",
  "Mauritius",
];

export const dailyTournamentCourses: ScheduledCourse[] = [
  ...popularDailyCourses,
  ...Array.from({ length: 365 - popularDailyCourses.length }, (_, index) => ({
    name: `${fillerRegions[index % fillerRegions.length]} World Tour ${index + 1}`,
    country: fillerCountries[index % fillerCountries.length],
  })),
];

export const weeklyOpenCourses: ScheduledCourse[] = [
  { name: "Pebble Beach Golf Links", country: "USA" },
  { name: "Royal Melbourne West", country: "Australia" },
  { name: "TPC Sawgrass - Stadium Course", country: "USA" },
  { name: "Royal County Down", country: "Northern Ireland" },
  { name: "Kiawah Island - Ocean Course", country: "USA" },
  { name: "Le Golf National - Albatros", country: "France" },
  { name: "Kingston Heath", country: "Australia" },
  { name: "Bandon Dunes", country: "USA" },
  { name: "Real Club Valderrama", country: "Spain" },
  { name: "Cape Kidnappers", country: "New Zealand" },
  { name: "Sentosa - Serapong", country: "Singapore" },
  { name: "Fancourt - The Links", country: "South Africa" },
];

export const monthlyMajorCourses: ScheduledCourse[] = [
  { name: "Kapalua - Plantation", country: "USA" },
  { name: "Pebble Beach Golf Links", country: "USA" },
  { name: "TPC Sawgrass - Stadium Course", country: "USA" },
  { name: "Augusta National Golf Club", country: "USA" },
  { name: "Quail Hollow Club", country: "USA" },
  { name: "Oakmont Country Club", country: "USA" },
  { name: "Royal Portrush - Dunluce", country: "Northern Ireland" },
  { name: "Royal Birkdale", country: "England" },
  { name: "East Lake Golf Club", country: "USA" },
  { name: "Bethpage Black", country: "USA" },
  { name: "Royal Melbourne West", country: "Australia" },
  { name: "The Old Course at St Andrews", country: "Scotland" },
];

export function getScheduledTournamentSet(date = new Date()): ScheduledTournament[] {
  const day = startOfUtcDay(date);
  const week = startOfUtcWeek(date);
  const month = startOfUtcMonth(date);
  const dailyCourse = dailyTournamentCourses[rotationIndex(day, dailyTournamentCourses.length, 73)];
  const weeklyCourse = weeklyOpenCourses[rotationIndex(week, weeklyOpenCourses.length, 5)];
  const monthlyCourse = monthlyMajorCourses[month.getUTCMonth() % monthlyMajorCourses.length];

  return [
    {
      key: `daily-${day.toISOString().slice(0, 10)}`,
      kind: "daily",
      title: "Daily Tournament",
      eyebrow: "Today",
      description: "One verified round on today's global rotation course.",
      course: dailyCourse,
      startsAt: day,
      endsAt: endOfUtcDay(day),
      format: "course_record_sprint",
      roundCount: 1,
      verificationPolicy: "silver",
    },
    {
      key: `weekly-open-${week.toISOString().slice(0, 10)}`,
      kind: "weekly",
      title: "Weekly Open",
      eyebrow: "This week",
      description: "Two verified rounds, gross and net standings, open all week.",
      course: weeklyCourse,
      startsAt: week,
      endsAt: endOfUtcDay(addUtcDays(week, 6)),
      format: "two_round_open",
      roundCount: 2,
      verificationPolicy: "gold",
    },
    {
      key: `monthly-major-${month.toISOString().slice(0, 7)}`,
      kind: "monthly",
      title: "Monthly Major",
      eyebrow: "This month",
      description: "Four-round major-style event on a famous championship venue.",
      course: monthlyCourse,
      startsAt: month,
      endsAt: endOfUtcDay(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0))),
      format: "four_round_major",
      roundCount: 4,
      verificationPolicy: "gold",
    },
  ];
}

function rotationIndex(date: Date, length: number, stride: number) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayIndex = Math.floor((date.getTime() - start) / MS_PER_DAY);
  return Math.abs((dayIndex * stride + date.getUTCFullYear() * 17) % length);
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function startOfUtcWeek(date: Date) {
  const day = startOfUtcDay(date);
  const weekday = day.getUTCDay() || 7;
  return addUtcDays(day, 1 - weekday);
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}
