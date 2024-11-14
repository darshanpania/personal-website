import { GraduationCap, Calendar, MapPin } from 'lucide-react';

interface EducationItem {
  degree: string;
  institution: string;
  year: string;
  location: string;
}

const educationData: EducationItem[] = [
  {
    degree: "Bachelor of Engineering - I.T.",
    institution: "Mumbai University",
    year: "2008 - 2012",
    location: "MUMBAI"
  },
  {
    degree: "Class XII",
    institution: "Rajhans Vidyalaya",
    year: "2008",
    location: "MUMBAI"
  },
  {
    degree: "Class X",
    institution: "The Indian High School",
    year: "2006",
    location: "DUBAI, U.A.E."
  }
];

const EducationCard = ({ education }: { education: EducationItem }) => {
  return (
    <div className="group relative p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="absolute -left-3 top-8 h-6 w-6 rounded-full border-4 border-white dark:border-gray-900 bg-blue-500 group-hover:bg-blue-600 transition-colors" />
      
      <div className="ml-2">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">
          {education.degree}
        </h3>
        
        <div className="mt-2 flex items-center text-gray-600 dark:text-gray-300">
          <GraduationCap className="w-4 h-4 mr-2" />
          <span>{education.institution}</span>
        </div>
        
        <div className="mt-2 flex items-center space-x-4">
          <div className="flex items-center text-gray-500 dark:text-gray-400">
            <Calendar className="w-4 h-4 mr-2" />
            <span>{education.year}</span>
          </div>
          
          <div className="flex items-center text-gray-500 dark:text-gray-400">
            <MapPin className="w-4 h-4 mr-2" />
            <span>{education.location}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Education = () => {
  return (
    <section id="education" className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Education
          </h2>
          
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
            
            {/* Education cards */}
            <div className="space-y-8">
              {educationData.map((edu, index) => (
                <EducationCard key={index} education={edu} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Education;