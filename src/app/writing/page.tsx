// app/writing/page.tsx
import { Laptop, BookOpen, Plane, Utensils } from 'lucide-react';

interface Article {
  title: string;
  description: string;
  platform: string;
  url: string;
  date: string;
}

interface CategorySection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  articles: Article[];
}

const categories: CategorySection[] = [
  {
    id: 'tech',
    title: 'Tech Blogs',
    description: 'Articles about software engineering, leadership, and technology',
    icon: Laptop,
    articles: [
        {
            title: "Creating Push Notifications in Android O – Part 2",
            description: "A guide to creating push notifications in Android O. Part 2 of 2",
            platform: "CleverTap Tech Blog",
            url: "https://tech.clevertap.com/creating-push-notifications-in-android-o-part-2/",
            date: "July 24, 2018"
        },
        {
            title: "Creating Push Notifications in Android O – Part 1",
            description: "A guide to creating push notifications in Android O. Part 1 of 2",
            platform: "CleverTap Tech Blog",
            url: "https://tech.clevertap.com/creating-push-notifications-in-android-o-part-1/",
            date: "July 13, 2018"
        },
        {
            title: "Understanding Permissions in the Android World",
            description: "A guide to understanding permissions in the Android World",
            platform: "CleverTap Tech Blog",
            url: "https://tech.clevertap.com/understanding-permissions-in-the-android-world/",
            date: "July 11, 2018"
        },
        {
            title: "Custom Layouts for your Push Notification",
            description: "A deep dive into building custom layouts for your push notifications",
            platform: "Medium",
            url: "https://medium.com/android-news/custom-layouts-for-your-push-notification-d8219d9962e",
            date: "July 3, 2017"
        }
    ]
  },
  {
    id: 'fiction',
    title: 'Fiction',
    description: 'Short stories and creative writing pieces',
    icon: BookOpen,
    articles: [
        {
            title: "Zephyr's Odyssey: The Rescue",
            description: "Part II of the Zephyr's Odyssey series - The mission continues",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/zephyrs-odyssey-the-rescue",
            date: "October 5, 2023"
        },
        {
            title: "Zephyr's Odyssey: Stellar Wave",
            description: "Part I of the Zephyr's Odyssey series - A new adventure begins",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/zephyrs-odyssey-stellar-wave",
            date: "September 23, 2023"
        },
        {
            title: "Two Weeks Off",
            description: "A story about taking a break and what unfolds",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/two-weeks-off",
            date: "March 7, 2021"
        },
        {
            title: "Space Oddity",
            description: "A tale of cosmic exploration and discovery",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/space-oddity",
            date: "February 14, 2021"
        },
        {
            title: "The Library V",
            description: "Part V of The Library series - The conclusion",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/the-library-v",
            date: "February 7, 2021"
        },
        {
            title: "The Library IV",
            description: "Part IV of The Library series - The plot thickens",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/the-library-iv",
            date: "January 31, 2021"
        },
        {
            title: "The Library III",
            description: "Part III of The Library series - Deeper into the mystery",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/the-library-iii",
            date: "January 24, 2021"
        },
        {
            title: "The Library II",
            description: "Part II of The Library series - The story continues",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/the-library-ii",
            date: "January 17, 2021"
        },
        {
            title: "The Library",
            description: "Part I of The Library series - A journey begins",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/the-library",
            date: "January 10, 2021"
        },
        {
            title: "Twenty Twenty One",
            description: "A reflective piece on the turning of a new year",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/twenty-twenty-one",
            date: "January 3, 2021"
        },
        {
            title: "The Year That Wasn't",
            description: "Two short stories on What If?",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/the-year-that-wasnt",
            date: "December 27, 2020"
        },
        {
            title: "December 20th, 2020",
            description: "Two short stories.",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/december-20th-2020",
            date: "December 20, 2020"
        },
        {
            title: "The Anger Bar - V",
            description: "A story on man's victory over his anger. Part 5 of 5",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/the-anger-bar-v",
            date: "December 13, 2020"
        },
        {
            title: "The Anger Bar - IV",
            description: "A story on man's victory over his anger. Part 4 of 5",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/the-anger-bar-iv",
            date: "December 06, 2020"
        },
        {
            title: "The Anger Bar - III",
            description: "A story on man's victory over his anger. Part 3 of 5",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/the-anger-bar-iii",
            date: "November 29, 2020"
        },
        {
            title: "The Anger Bar - II",
            description: "A story on man's victory over his anger. Part 2 of 5",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/the-anger-bar-ii",
            date: "November 22, 2020"
        },
        {
            title: "The Anger Bar",
            description: "A story on man's victory over his anger. Part 1 of 5",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/the-anger-bar",
            date: "November 08, 2020"
        },
        {
            title: "Retrouvaille",
            description: "A short story about long distance love",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/retrouvaille",
            date: "November 08, 2020"
        },
        {
            title: "Wonderwall",
            description: "A short story about a man's journey to find his lost love",
            platform: "Substack",
            url: "https://lostmeanderingthoughts.substack.com/p/wonderwall",
            date: "November 01, 2020"
        },
        {
            title: "The Nomadic Soul",
            description: "A short story about a nomad's journey",
        platform: "Substack",
        url: "https://lostmeanderingthoughts.substack.com/p/the-nomadic-soul",
            date: "October 25, 2020"
        }
      // Add more fiction pieces
    ]
  },
  {
    id: 'travel',
    title: 'Travel',
    description: 'Travel experiences and destination guides',
    icon: Plane,
    articles: [
      {
        title: "Turkey Itinerary - December 2023",
        description: "A detailed itinerary for a 10 day trip to Turkey in December 2023",
        platform: "ThinkDeli",
        url: "https://thinkdeli.com/post/turkey-itinerary---december-202324-802",
        date: "June 20, 2024"
      },
      // Add more travel articles
    ]
  },
  {
    id: 'food',
    title: 'Food',
    description: 'Culinary adventures and food reviews',
    icon: Utensils,
    articles: [
      {
        title: "Recipes I Make: Authentic Lebanese Hummus",
        description: "A recipe for authentic Lebanese Hummus",
        platform: "ThinkDeli",
        url: "https://thinkdeli.com/post/recipes-i-make-authentic-lebanese-hummus-1213",
        date: "November 8, 2024"
      },
      // Add more food articles
    ]
  }
];

const CategoryArticles = ({ category }: { category: CategorySection }) => {
  const Icon = category.icon;
  
  return (
    <div className="mb-16">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {category.title}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
            {category.description}
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {category.articles.map((article, index) => (
          <a
            key={index}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 group"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {article.title}
                </h3>
                
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  {article.description}
                </p>
                
                <div className="mt-4 flex items-center space-x-4 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {article.date}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                    {article.platform}
                  </span>
                </div>
              </div>
              
              <div className="ml-4">
                <svg
                  className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default function WritingPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      
      <div className="pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Writing
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                A collection of my writings across various topics and platforms
              </p>
            </div>

            {/* Quick Navigation */}
            <div className="mb-16 flex flex-wrap justify-center gap-4">
              {categories.map((category) => (
                <a
                  key={category.id}
                  href={`#${category.id}`}
                  className="px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-sm hover:shadow-md transition-all duration-300 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {category.title}
                </a>
              ))}
            </div>

            {/* Categories */}
            {categories.map((category) => (
              <div key={category.id} id={category.id}>
                <CategoryArticles category={category} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}