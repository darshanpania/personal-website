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
        "In 2024, I transitioned to lead the App-Experiences full-stack team, managing 3 Team Leads and 12 engineers across Mumbai and Sofia. In this role, I collaborate closely with product and design leaders to craft innovative mobile app experiences — driving initiatives such as In-App Experiences, Remote Configs, and A/B Testing to elevate user engagement.",
        "Previously, I was a key contributor to the CleverTap RenderMax SDK initiative, enhancing push notification deliverability and user engagement—  a project distinguished by a patent pending.",
        "I played a pivotal role in steering the integration project during the Leanplum acquisition, successfully merging key features between the Leanplum and CleverTap SDKs while maintaining high performance and stability.",
        "Building a strong foundation, I facilitated cross-functional collaboration across teams, mentoring engineers and ensuring smooth SDK releases and integration processes while promoting best practices in coding and professional development.",
        "In 2021, I led the architectural refactoring of CleverTap’s Android SDK—prioritizing unit testing and code quality through the adoption of tools like Mockito, JUnit, and GitHub Actions, as well as establishing robust UI automation testing frameworks using BrowserStack and internal tools.",
        "Starting as the fi rst Android developer, I eventually led the Mobile SDK development team, growing it to 15 members and directing the successful launch of 10 Mobile SDKs, 2 Web SDKs, and 3 partner SDKs. This effort greatly enhanced CleverTap’s presence across several platforms, including Android, Flutter, iOS, React Native, Cordova, and Unity."
        ]
    },
    {
        role: "Lead Android Engineer",
        company: "DawaiBox",
        duration: "NOVEMBER 2016 - JUNE 2017",
        location: "MUMBAI",
        achievements: [
        "Worked on a comprehensive overhaul of the Doctor and Patient Android applications, leveraging the full spectrum of native Android APIs including Camera, Fragments, AsyncTasks, ViewPagers, TabLayouts, and Services, among others.",
        "Additionally, developed functionality using multiple essential Android libraries such as Retrofit, Volley, Glide, and MPAndroid Charts."
        ]
    },
    {
        role: "Product Lead",
        company: "Grabstr",
        duration: "JULY 2015 - OCTOBER 2016",
        location: "MUMBAI",
        achievements: [
        "Collaborated with cross-functional teams to lead the end-to-end development cycle of all features for the Google Play Store release.",
        "Oversaw the planning, execution, and testing phases while ensuring the successful deployment of the product.",
        "Managed and mentored a team of 5 interns who were assigned various modules, including UI/UX design, core logic coding, and more, to ensure the timely delivery of high-quality work."
        ]
    },
    {
        role: "Senior Software Engineer",
        company: "Accenture",
        duration: "SEPTEMBER 2012 – JULY 2015",
        location: "MUMBAI & BANGALORE",
        achievements: [
        "As a Senior Software Engineer at Accenture, I significantly enhanced AT&T's server deployment processes, leading the migration of deployment scripts from Unix to Linux for improved efficiency and reliability.",
        "I automated numerous manual operations using Unix Shell Scripting and Cron Batch Jobs, saving time and cost. Additionally, I handled ad-hoc change requests for Data Migration from COBOL to JAVA, showcasing my technical expertise and adaptability."
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