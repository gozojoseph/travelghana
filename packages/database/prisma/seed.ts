/**
 * Seed: Ghana's 16 regions + key cities (real data, not placeholder).
 * Destinations/attractions/providers are entered via Admin (operator-first, D5)
 * — this seed only covers the static geographic backbone.
 */
import { PrismaClient, type DestinationCategory } from "../src/generated";

const prisma = new PrismaClient();

const regions: Array<{
  slug: string;
  name: string;
  cities: Array<{ slug: string; name: string; lat: number; lng: number }>;
}> = [
  {
    slug: "greater-accra",
    name: "Greater Accra",
    cities: [
      { slug: "accra", name: "Accra", lat: 5.6037, lng: -0.187 },
      { slug: "tema", name: "Tema", lat: 5.6698, lng: -0.0166 },
    ],
  },
  {
    slug: "central",
    name: "Central",
    cities: [
      { slug: "cape-coast", name: "Cape Coast", lat: 5.1315, lng: -1.2795 },
      { slug: "elmina", name: "Elmina", lat: 5.0843, lng: -1.3478 },
    ],
  },
  {
    slug: "ashanti",
    name: "Ashanti",
    cities: [{ slug: "kumasi", name: "Kumasi", lat: 6.6885, lng: -1.6244 }],
  },
  {
    slug: "western",
    name: "Western",
    cities: [{ slug: "takoradi", name: "Takoradi", lat: 4.8956, lng: -1.7554 }],
  },
  {
    slug: "volta",
    name: "Volta",
    cities: [{ slug: "ho", name: "Ho", lat: 6.6009, lng: 0.4713 }],
  },
  {
    slug: "northern",
    name: "Northern",
    cities: [{ slug: "tamale", name: "Tamale", lat: 9.4008, lng: -0.8393 }],
  },
  {
    slug: "eastern",
    name: "Eastern",
    cities: [
      { slug: "koforidua", name: "Koforidua", lat: 6.0941, lng: -0.2591 },
      { slug: "aburi", name: "Aburi", lat: 5.8492, lng: -0.1742 },
    ],
  },
  {
    slug: "western-north",
    name: "Western North",
    cities: [{ slug: "sefwi-wiawso", name: "Sefwi Wiawso", lat: 6.1211, lng: -2.4964 }],
  },
  {
    slug: "ahafo",
    name: "Ahafo",
    cities: [{ slug: "goaso", name: "Goaso", lat: 6.9872, lng: -2.5192 }],
  },
  {
    slug: "bono",
    name: "Bono",
    cities: [{ slug: "sunyani", name: "Sunyani", lat: 7.3349, lng: -2.3268 }],
  },
  {
    slug: "bono-east",
    name: "Bono East",
    cities: [{ slug: "techiman", name: "Techiman", lat: 7.5898, lng: -1.9401 }],
  },
  {
    slug: "oti",
    name: "Oti",
    cities: [{ slug: "dambai", name: "Dambai", lat: 7.8953, lng: 0.1678 }],
  },
  {
    slug: "savannah",
    name: "Savannah",
    cities: [{ slug: "damango", name: "Damango", lat: 9.0764, lng: -1.815 }],
  },
  {
    slug: "north-east",
    name: "North East",
    cities: [{ slug: "nalerigu", name: "Nalerigu", lat: 10.5667, lng: -0.3667 }],
  },
  {
    slug: "upper-east",
    name: "Upper East",
    cities: [{ slug: "bolgatanga", name: "Bolgatanga", lat: 10.7854, lng: -0.8514 }],
  },
  {
    slug: "upper-west",
    name: "Upper West",
    cities: [{ slug: "wa", name: "Wa", lat: 10.0601, lng: -2.5099 }],
  },
];

interface SeedAttraction {
  slug: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
}

interface SeedDestination {
  citySlug: string;
  slug: string;
  name: string;
  category: DestinationCategory;
  summary: string;
  description: string;
  lat: number;
  lng: number;
  featured?: boolean;
  attractions: SeedAttraction[];
}

/** Real Ghanaian destinations with real (approximate) coordinates — no placeholder data (§51). */
const destinations: SeedDestination[] = [
  {
    citySlug: "cape-coast",
    slug: "cape-coast-castle",
    name: "Cape Coast Castle",
    category: "HISTORICAL",
    summary: "UNESCO-listed castle and one of West Africa's most significant heritage sites.",
    description:
      "Originally built in 1653 and later expanded under British rule, Cape Coast Castle played a central role in the trans-Atlantic slave trade. Today it houses a museum, and guided tours take visitors through the dungeons and the Door of No Return.",
    lat: 5.1053,
    lng: -1.2466,
    featured: true,
    attractions: [],
  },
  {
    citySlug: "elmina",
    slug: "elmina-castle",
    name: "Elmina Castle",
    category: "HISTORICAL",
    summary: "St. George's Castle — the oldest European building in sub-Saharan Africa (1482).",
    description:
      "Built by the Portuguese in 1482 and later held by the Dutch and the British, Elmina Castle is a UNESCO World Heritage Site overlooking the fishing town of Elmina.",
    lat: 5.0822,
    lng: -1.3472,
    featured: true,
    attractions: [
      {
        slug: "fort-coenraadsburg",
        name: "Fort Coenraadsburg",
        description:
          "Dutch-built hilltop fort overlooking Elmina Castle, later used as a rest house and prison.",
        lat: 5.0846,
        lng: -1.3453,
      },
    ],
  },
  {
    citySlug: "cape-coast",
    slug: "kakum-national-park",
    name: "Kakum National Park",
    category: "NATURE",
    summary: "Primary rainforest with Ghana's famous canopy walkway, 40 metres above the forest floor.",
    description:
      "Kakum protects one of West Africa's last tracts of primary rainforest. The canopy walkway offers a bird's-eye view of the forest, and guided trails introduce forest elephants, antelopes and hundreds of bird and butterfly species.",
    lat: 5.3497,
    lng: -1.3854,
    featured: true,
    attractions: [
      {
        slug: "kakum-canopy-walkway",
        name: "Kakum Canopy Walkway",
        description: "A series of seven suspension bridges strung high above the rainforest canopy.",
        lat: 5.3526,
        lng: -1.3866,
      },
    ],
  },
  {
    citySlug: "accra",
    slug: "kwame-nkrumah-memorial-park",
    name: "Kwame Nkrumah Memorial Park",
    category: "HISTORICAL",
    summary: "Mausoleum and museum honouring Ghana's first president and the independence story.",
    description:
      "Located on the site where independence was declared in 1957, the park holds the mausoleum of Kwame Nkrumah and a museum of personal artifacts and photographs.",
    lat: 5.5483,
    lng: -0.1963,
    featured: true,
    attractions: [],
  },
  {
    citySlug: "accra",
    slug: "independence-square",
    name: "Independence Square & Black Star Gate",
    category: "HISTORICAL",
    summary: "Ghana's ceremonial parade ground, crowned by the Black Star Gate.",
    description:
      "One of the largest city squares in the world, Independence Square hosts national celebrations. The Black Star Gate commemorates Ghana's independence and the Black Star nation symbol.",
    lat: 5.5504,
    lng: -0.1971,
    attractions: [
      {
        slug: "black-star-gate",
        name: "Black Star Gate",
        description: "The monumental independence arch inscribed 'AD 1957 — Freedom and Justice'.",
        lat: 5.5497,
        lng: -0.1969,
      },
    ],
  },
  {
    citySlug: "accra",
    slug: "labadi-beach",
    name: "Labadi Beach",
    category: "BEACH",
    summary: "Accra's most popular beach — music, food stalls and Atlantic surf.",
    description:
      "Also known as La Pleasure Beach, Labadi is the liveliest stretch of coast in Accra, with reggae evenings, beach football and local food stalls.",
    lat: 5.5577,
    lng: -0.1569,
    attractions: [],
  },
  {
    citySlug: "accra",
    slug: "jamestown-lighthouse",
    name: "Jamestown Lighthouse",
    category: "HISTORICAL",
    summary: "Historic 1930s lighthouse in Accra's atmospheric old fishing quarter.",
    description:
      "Jamestown is Accra's oldest district — colonial architecture, working fishing harbour, street art and the British-built lighthouse that you can climb for views over the Gulf of Guinea.",
    lat: 5.5317,
    lng: -0.2086,
    attractions: [],
  },
  {
    citySlug: "accra",
    slug: "makola-market",
    name: "Makola Market",
    category: "CITY",
    summary: "Accra's largest and most vibrant market.",
    description:
      "A maze of stalls selling fabric, food, spices and everything between — Makola is the commercial heartbeat of Accra and a sensory introduction to the city.",
    lat: 5.5512,
    lng: -0.2136,
    attractions: [],
  },
  {
    citySlug: "tema",
    slug: "shai-hills-resource-reserve",
    name: "Shai Hills Resource Reserve",
    category: "NATURE",
    summary: "Savanna reserve with baboons, zebras, ostriches and ancient Shai shrines.",
    description:
      "Just an hour from Accra, Shai Hills combines wildlife viewing, rock climbing on its inselberg hills and cultural sites of the historic Shai people.",
    lat: 5.8833,
    lng: 0.0483,
    attractions: [],
  },
  {
    citySlug: "aburi",
    slug: "aburi-botanical-gardens",
    name: "Aburi Botanical Gardens",
    category: "NATURE",
    summary: "Colonial-era botanical gardens on the cool Akuapem ridge.",
    description:
      "Established in 1890, the gardens hold centuries-old trees, palms and flowers, and the ridge offers sweeping views toward Accra.",
    lat: 5.8492,
    lng: -0.1742,
    attractions: [],
  },
  {
    citySlug: "koforidua",
    slug: "boti-falls",
    name: "Boti Falls",
    category: "NATURE",
    summary: "Twin seasonal waterfalls in a forest reserve east of Koforidua.",
    description:
      "The male and female twin falls meet in a splash of mist — traditionally, visitors are 'sprayed' for good luck. Umbrella Rock and the three-trunk palm tree are nearby.",
    lat: 6.0267,
    lng: -0.2019,
    attractions: [
      {
        slug: "umbrella-rock",
        name: "Umbrella Rock",
        description: "A natural rock formation balanced like an umbrella, a short hike from Boti Falls.",
        lat: 6.0344,
        lng: -0.1961,
      },
    ],
  },
  {
    citySlug: "ho",
    slug: "wli-waterfalls",
    name: "Wli Waterfalls",
    category: "NATURE",
    summary: "Ghana's tallest waterfall, cascading off the Akwapim-Togo range.",
    description:
      "A flat forest walk leads to the lower falls, where thousands of fruit bats swirl overhead; a steeper hike reaches the upper falls. Wli is the highest waterfall in West Africa.",
    lat: 6.1128,
    lng: 0.6099,
    featured: true,
    attractions: [
      {
        slug: "wli-upper-falls",
        name: "Wli Upper Falls",
        description: "The upper cascade, reached on a guided mountain hike of a few hours.",
        lat: 6.1131,
        lng: 0.6105,
      },
    ],
  },
  {
    citySlug: "ho",
    slug: "mount-afadja",
    name: "Mount Afadja",
    category: "NATURE",
    summary: "Ghana's highest peak (885 m), climbed from the village of Liati Wote.",
    description:
      "Afadjato rises above the Volta villages near the Togo border. Community guides lead the climb through forest and farms to sweeping views at the summit.",
    lat: 6.6483,
    lng: 0.3667,
    attractions: [],
  },
  {
    citySlug: "kumasi",
    slug: "lake-bosomtwe",
    name: "Lake Bosomtwe",
    category: "NATURE",
    summary: "A sacred meteorite-crater lake — Ghana's only natural lake.",
    description:
      "Ringed by villages and forested crater walls, Bosomtwe is revered by the surrounding communities. Canoeing, cycling and hiking the rim are the classic activities.",
    lat: 6.5086,
    lng: -1.5833,
    attractions: [],
  },
  {
    citySlug: "kumasi",
    slug: "manhyia-palace-museum",
    name: "Manhyia Palace Museum",
    category: "CULTURAL",
    summary: "The seat of the Asantehene, home of Asante history and culture.",
    description:
      "The museum within Manhyia Palace presents the history of the Asante Kingdom, including artifacts, regalia and the story of the Golden Stool.",
    lat: 6.688,
    lng: -1.63,
    attractions: [],
  },
  {
    citySlug: "kumasi",
    slug: "kejetia-market",
    name: "Kejetia Market",
    category: "CITY",
    summary: "One of West Africa's largest open-air markets, in the heart of Kumasi.",
    description:
      "Thousands of traders sell kente, produce, crafts and more across Kejetia's sprawling rows — the essential Kumasi experience.",
    lat: 6.6933,
    lng: -1.6244,
    attractions: [],
  },
  {
    citySlug: "tamale",
    slug: "mole-national-park",
    name: "Mole National Park",
    category: "NATURE",
    summary: "Ghana's largest wildlife park — elephants, antelope and walking safaris.",
    description:
      "Mole's savanna and gallery forest are home to hundreds of elephants, plus buffalo, kob, baboons and rich birdlife. Guided walking safaris are a signature experience.",
    lat: 9.4025,
    lng: -1.845,
    featured: true,
    attractions: [],
  },
  {
    citySlug: "tamale",
    slug: "larabanga-mosque",
    name: "Larabanga Mosque",
    category: "CULTURAL",
    summary: "Sudanese-style mosque dating to around the 14th century — the oldest in Ghana.",
    description:
      "Built of mud and sticks in the West Sudanese style and repaired over centuries, Larabanga Mosque is often called the 'Mecca of West Africa'. The town's ancient Quran is kept here.",
    lat: 9.2247,
    lng: -1.8461,
    attractions: [],
  },
  {
    citySlug: "takoradi",
    slug: "busua-beach",
    name: "Busua Beach",
    category: "BEACH",
    summary: "Laid-back surf beach on Ghana's western coast.",
    description:
      "Busua's long sandy bay is Ghana's surf hub, with mellow waves, beachfront lodges and easy access to Dixcove's historic fort.",
    lat: 4.8167,
    lng: -2.1167,
    attractions: [],
  },
  {
    citySlug: "takoradi",
    slug: "nzulezo-stilt-village",
    name: "Nzulezo Stilt Village",
    category: "CULTURAL",
    summary: "A village built entirely on stilts over Lake Tadane.",
    description:
      "Reached by canoe through the Amansuri wetland, Nzulezo's houses, school and church all stand on stilts above the water — a living community over five centuries old.",
    lat: 5.0442,
    lng: -2.4364,
    attractions: [],
  },
];

async function seedRegions(): Promise<void> {
  console.log("Seeding regions and cities…");
  for (const [i, region] of regions.entries()) {
    const r = await prisma.region.upsert({
      where: { slug: region.slug },
      update: { name: region.name, sort: i },
      create: { slug: region.slug, name: region.name, sort: i },
    });
    for (const city of region.cities) {
      await prisma.city.upsert({
        where: { regionId_slug: { regionId: r.id, slug: city.slug } },
        update: { name: city.name, lat: city.lat, lng: city.lng },
        create: {
          regionId: r.id,
          slug: city.slug,
          name: city.name,
          lat: city.lat,
          lng: city.lng,
        },
      });
    }
  }
}

async function seedDestinations(): Promise<void> {
  console.log("Seeding destinations and attractions…");
  for (const d of destinations) {
    const city = await prisma.city.findFirst({ where: { slug: d.citySlug } });
    if (!city) {
      throw new Error(`Seed data error: unknown city slug "${d.citySlug}"`);
    }
    const destination = await prisma.destination.upsert({
      where: { slug: d.slug },
      update: {
        name: d.name,
        category: d.category,
        summary: d.summary,
        description: d.description,
        lat: d.lat,
        lng: d.lng,
        featured: d.featured ?? false,
        published: true,
      },
      create: {
        cityId: city.id,
        slug: d.slug,
        name: d.name,
        category: d.category,
        summary: d.summary,
        description: d.description,
        lat: d.lat,
        lng: d.lng,
        featured: d.featured ?? false,
        published: true,
      },
    });
    for (const a of d.attractions) {
      await prisma.attraction.upsert({
        where: { slug: a.slug },
        update: {
          name: a.name,
          description: a.description,
          lat: a.lat,
          lng: a.lng,
        },
        create: {
          destinationId: destination.id,
          cityId: city.id,
          slug: a.slug,
          name: a.name,
          description: a.description,
          lat: a.lat,
          lng: a.lng,
        },
      });
    }
  }
}

async function main() {
  await seedRegions();
  await seedDestinations();
  const counts = {
    regions: await prisma.region.count(),
    cities: await prisma.city.count(),
    destinations: await prisma.destination.count(),
    attractions: await prisma.attraction.count(),
  };
  console.log(
    `Seed complete: ${counts.regions} regions, ${counts.cities} cities, ${counts.destinations} destinations, ${counts.attractions} attractions.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
