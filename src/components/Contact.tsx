import { Mail, MapPin, Linkedin, Twitter, Calendar } from 'lucide-react';

const ContactCard = ({ 
icon: Icon, 
title, 
content, 
link 
}: { 
icon: React.ElementType;
title: string;
content: string;
link?: string;
}) => (
<div className="flex items-center space-x-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow">
    <div className="flex-shrink-0">
    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-full">
        <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
    </div>
    </div>
    <div>
    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {title}
    </h3>
    {link ? (
        <a 
        href={link}
        target={link.startsWith('http') ? '_blank' : undefined}
        rel={link.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="text-lg font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
        {content}
        </a>
    ) : (
        <p className="text-lg font-medium text-gray-900 dark:text-white">
        {content}
        </p>
    )}
    </div>
</div>
);

const SocialLink = ({ 
    icon: Icon, 
    href, 
    label 
}: { 
    icon: React.ElementType;
href: string;
label: string;
}) => (
<a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="p-4 flex items-center space-x-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all hover:translate-y-[-2px]"
    aria-label={label}
>
    <Icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
    <span className="font-medium text-gray-600 dark:text-gray-300">{label}</span>
</a>
);

const Contact = () => {
return (
    <section id="contact" className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                Get in Touch
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
                Feel free to reach out for opportunities or just to say hello
            </p>
        </div>
        </div>
        <div className="space-y-6">
        <ContactCard
            icon={Mail}
            title="Email"
            content="darshanpania@gmail.com"
            link="mailto:darshanpania@gmail.com"
            />
            
        <ContactCard
            icon={Calendar}
            title="Schedule a Meeting"
            content="Book a 30-minute call"
              link="https://cal.com/darshanpania/30min" // Replace with your actual calendar link
            />
            
        <ContactCard
            icon={MapPin}
            title="Location"
            content="Jogeshwari West, Mumbai, 400102"
            />
        </div>

        <div className="mt-12">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-6">
            Connect with Me
            </h3>
            <div className="grid grid-cols-2 gap-4">
            <SocialLink
                icon={Linkedin}
                href="https://linkedin.com/in/darshanpania"
                label="LinkedIn"
            />
            <SocialLink
                icon={Twitter}
                href="https://twitter.com/i_m_Pania"
                label="Twitter"
            />
            </div>
        </div>
    </div>
    </section>
    );
};

export default Contact;