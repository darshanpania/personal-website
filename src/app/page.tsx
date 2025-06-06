// app/page.tsx
import Hero from '@/components/Hero';
import Experience from '@/components/Experience';
import Education from '@/components/Education';
import Awards from '@/components/Awards';
import Contact from '@/components/Contact';

export default function Home() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-900">
      {/* Main content */}
      <div className="flex flex-col">
        {/* Hero Section */}
        <Hero />

        {/* Experience Section */}
        <div className="bg-white dark:bg-gray-900">
          <Experience />
        </div>

        {/* Education Section */}
        <div className="bg-gray-50 dark:bg-gray-800">
          <Education />
        </div>

        {/* Awards Section */}
        <div className="bg-white dark:bg-gray-900">
          <Awards />
        </div>

        {/* Contact Section */}
        <div className="bg-gray-50 dark:bg-gray-800">
          <Contact />
        </div>
      </div>
    </main>
  );
}