'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar, Building } from 'lucide-react';
import { AnimationWrapper } from '@/components/animations/AnimationWrapper';

interface ExperienceItem {
    role: string;
    company: string;
    duration: string;
    location: string;
    achievements: string[];
}

const experiences: ExperienceItem[] = [
    {
        role: "Director - Engineering",
        company: "CleverTap",
        duration: "JUNE 2017 - PRESENT",
        location: "MUMBAI",
        achievements: [
        "Led the Mobile SDK development team, expanding it to 15 members and directing the launch of 10 Mobile SDKs, 2 Web SDKs, and 3 data integration partner SDKs.",
        "Architected the 2021 refactoring of CleverTap's Android SDK, prioritizing unit testing and code quality.",
        "Facilitated cross-functional collaboration, ensuring smooth SDK releases and integration processes.",
        "Played a pivotal role in the Leanplum acquisition integration project.",
        "Key contributor to the CleverTap RenderMax SDK development.",
        "Transitioned to head the Gaming and LiveOps full-stack team in 2024, managing 12 technical professionals."
        ]
    },
    {
        role: "Lead Android Engineer",
        company: "DawaiBox",
        duration: "NOVEMBER 2016 - JUNE 2017",
        location: "MUMBAI",
        achievements: [
        "Led a comprehensive overhaul of the Doctor and Patient Android applications.",
        "Developed functionality using multiple essential Android libraries such as Retrofit, Volley, Glide, and MPAndroid Charts."
        ]
    },
    {
        role: "Product Lead",
        company: "Grabstr",
        duration: "JULY 2015 - OCTOBER 2016",
        location: "MUMBAI",
        achievements: [
        "Collaborated with cross-functional teams to lead the end-to-end development cycle.",
        "Oversaw the planning, execution, and testing phases.",
        "Managed and mentored a team of 5 interns."
        ]
    },
    {
        role: "Senior Software Engineer",
        company: "Accenture",
        duration: "SEPTEMBER 2012 – JULY 2015",
        location: "MUMBAI & BANGALORE",
        achievements: [
        "Enhanced AT&T's server deployment processes, leading migration from Unix to Linux.",
        "Automated manual operations using Unix Shell Scripting and Cron Batch Jobs.",
        "Handled ad-hoc change requests for Data Migration from COBOL to JAVA."
        ]
    }
    ];

const ExperienceCard = ({ experience, index }: { experience: ExperienceItem; index: number }) => {
const [isExpanded, setIsExpanded] = useState(false);

return (
    <AnimationWrapper
        animation="slide-left" 
        delay={index * 0.2}
    >
    <div className="mb-8 border-l-4 border-blue-500 pl-4 hover:border-blue-600 transition-colors">
        <div 
            className="cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
        >
        <div className="flex justify-between items-start">
            <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                {experience.role}
            </h3>
            <div className="flex items-center mt-1 text-gray-600 dark:text-gray-300">
                <Building className="w-4 h-4 mr-2" />
                <span className="font-medium">{experience.company}</span>
            </div>
            <div className="flex items-center mt-1 text-gray-500 dark:text-gray-400 text-sm">
                <Calendar className="w-4 h-4 mr-2" />
                <span>{experience.duration}</span>
                <span className="mx-2">•</span>
                <span>{experience.location}</span>
            </div>
            </div>
            <button 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            aria-label={isExpanded ? "Collapse details" : "Expand details"}
            >
            {isExpanded ? 
                <ChevronUp className="w-5 h-5 text-gray-500" /> : 
                <ChevronDown className="w-5 h-5 text-gray-500" />
            }
            </button>
        </div>
        </div>
        
        {isExpanded && (
            <AnimationWrapper animation="fade-up" delay={0.1}>
            <ul className="mt-4 space-y-2 text-gray-600 dark:text-gray-300">
                {experience.achievements.map((achievement, idx) => (
                <li key={idx} className="flex items-start">
                    <span className="mr-2 mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500"></span>
                    <span>{achievement}</span>
                </li>
            ))}
            </ul>
        </AnimationWrapper>
        )}
    </div>
    </AnimationWrapper>
);
};

const Experience = () => {
return (
    <section id="experience" className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
        <AnimationWrapper animation="fade-down" delay={0}>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            Professional Experience
            </h2>
        </AnimationWrapper>
        <div>
            {experiences.map((exp, index) => (
                <ExperienceCard key={index} experience={exp} index={index} />
            ))}
        </div>
        </div>
    </div>
    </section>
);
};

export default Experience;