'use client'; // Required for useState
import React, { useState } from 'react'; // Import useState
import { Smartphone, Apple, Globe, Github, ExternalLink } from 'lucide-react'; // Added icons

type ProjectCategory = 'All' | 'Android' | 'iOS' | 'Web';

interface Project {
  name: string;
  description: string;
  link: string;
  platform?: 'android' | 'ios' | 'web' | 'github' | 'other';
  category: ProjectCategory; // Added category
}

// Sample project data - replace with your actual projects
const projectsData: Project[] = [
  {
    name: 'Notificity',
    description: 'Notificity is an Android application designed to capture and categorize all incoming push notifications. It provides users with the ability to search through notifications both at the application level and using specific keywords. This project aims to enhance user productivity and notification management on Android devices.\n\nFeatures\nNotification Listener: Captures all incoming push notifications in real time.\nDatabase Storage: Stores details such as the notification title, content, timestamp, and originating application using Room DB.\nSearch Functionality: Enables users to search notifications by application or by specific keywords within the notifications.\nUI Design: Utilizes Material Design & Jetpack Compose for a modern and intuitive user interface.\nCategory Management: Notifications are categorized by application, allowing for organized viewing.',
    link: 'https://play.google.com/store/apps/details?id=com.darshan.notificity&hl=en',
    platform: 'android',
    category: 'Android',
  },
  {
    name: 'PantryChef',
    description: 'Coming soon',
    link: '#',
    platform: 'web',
    category: 'Web',
  }
];

const PlatformIcon: React.FC<{ platform?: Project['platform'] }> = ({ platform }) => {
  switch (platform) {
    case 'android':
      return <Smartphone className="w-5 h-5 mr-2" />;
    case 'ios':
      return <Apple className="w-5 h-5 mr-2" />;
    case 'web':
      return <Globe className="w-5 h-5 mr-2" />;
    case 'github':
      return <Github className="w-5 h-5 mr-2" />;
    default:
      return <ExternalLink className="w-5 h-5 mr-2" />;
  }
};

const projectCategories: ProjectCategory[] = ['All', 'Android', 'iOS', 'Web'];

const ProjectsPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory>('All');
  return (
    <main className="min-h-screen bg-white dark:bg-gray-900 py-12 pt-24 md:pt-28">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-4 text-gray-800 dark:text-white">
          Darshan&apos;s Dev Shop
        </h1>
        <p className="text-lg text-center text-gray-600 dark:text-gray-300 mb-8">
          A collection of my side projects across various platforms
        </p>

        {/* Category Filter Buttons */}
        <div className="mb-12 flex flex-wrap justify-center gap-3 md:gap-4">
          {projectCategories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all duration-300 text-sm md:text-base font-medium
                ${selectedCategory === category 
                  ? 'bg-blue-500 text-white dark:bg-blue-600'
                  : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              {category}
            </button>
          ))}
        </div>

        {projectsData.length > 0 ? (
          <div 
            className={`grid gap-8 ${projectsData.length === 1 ? 'grid-cols-1' : projectsData.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}
          >
            {projectsData.filter(p => selectedCategory === 'All' || p.category === selectedCategory).map((project) => (
              <div 
                key={project.name} 
                className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col transition-transform hover:scale-105 duration-300 ease-in-out"
              >
                <h3 className="text-xl font-semibold mb-2 text-gray-700 dark:text-gray-300">{project.name}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4 flex-grow text-sm whitespace-pre-line">{project.description}</p>
                <a 
                  href={project.link} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline self-start mt-auto"
                >
                  <PlatformIcon platform={project.platform} />
                  View Project
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-600 dark:text-gray-400">No projects in the &apos;{selectedCategory}&apos; category yet. Try selecting another category or check back soon!</p>
        )}
        {/* Display this message if no projects exist at all */}
        {projectsData.length === 0 && (
            <p className="text-center text-gray-600 dark:text-gray-400 mt-8">No projects to display yet. Check back soon!</p>
        )}
      </div>
    </main>
  );
};

export default ProjectsPage;

