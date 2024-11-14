'use client';
import { Award, ChevronRight } from 'lucide-react';

interface AwardItem {
  year: string;
  title: string;
  description?: string;
  issuer?: string;
}

const awardsData: AwardItem[] = [
  {
    year: "2024",
    title: "Certified Great People Manager",
    issuer: "Great Manager Institute, India",
    description: "Recognized for excellence in people management and leadership skills."
  },
  {
    year: "2022",
    title: '"Above & Beyond" Award',
    issuer: "CleverTap",
    description: "Awarded for exceptional contribution to the Leanplum acquisition integration."
  }
];

const AwardCard = ({ award }: { award: AwardItem }) => {
  return (
    <div className="relative group">
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-500 border-4 border-white dark:border-gray-900 group-hover:scale-110 transition-transform" />
      
      <div className="ml-6 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 group-hover:translate-x-1">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-blue-500" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">
                {award.title}
              </h3>
            </div>
            
            <div className="mt-2 space-y-2">
              {award.issuer && (
                <p className="text-gray-600 dark:text-gray-300">
                  {award.issuer}
                </p>
              )}
              {award.description && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {award.description}
                </p>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-full">
              {award.year}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Awards = () => {
  return (
    <section id="awards" className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Awards & Certifications
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              Recognition for excellence and professional achievements
            </p>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-0 top-0 h-full w-px bg-gray-200 dark:bg-gray-700" />
            
            {/* Awards list */}
            <div className="space-y-6">
              {awardsData.map((award, index) => (
                <AwardCard key={index} award={award} />
              ))}
            </div>

          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Continuously pursuing growth and excellence in technology and leadership
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Awards;