import { SimpleAnimation } from '@/components/animations/SimpleAnimation';

const Hero = () => {
    return (
        <section className="pt-32 pb-16 md:pt-40 md:pb-24 bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
            <div className="container mx-auto px-4">
                <div className="max-w-4xl mx-auto">
                    {/* Profile Image */}
                    <div className="flex justify-center mb-8">
                        <div className="relative w-40 h-40 md:w-48 md:h-48">
                            <img
                                src="/images/Darshan_Pic.jpg"  // Update this path to match your image location
                                alt="Darshan Pania"
                                className="rounded-full object-cover w-full h-full border-4 border-white dark:border-gray-800 shadow-lg"
                            />
                            <div className="absolute inset-0 rounded-full shadow-inner"></div>
                        </div>
                    </div>

                    <div className="text-center">
                    <SimpleAnimation animation="fade-down" delay={0.2}>
                        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
                            Director of Engineering
                        </h1>
                    </SimpleAnimation>
                    <SimpleAnimation animation="fade-up" delay={0.4}>
                        <div className="mb-8 flex justify-center space-x-4">
                            <a 
                                href="mailto:darshanpania@gmail.com"
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                                darshanpania@gmail.com
                            </a>
                            <span className="text-gray-400">|</span>
                            <a 
                                href="https://www.clevertap.com"
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                                CleverTap
                            </a>
                        </div>
                        </SimpleAnimation>
                        <SimpleAnimation animation="fade-up" delay={0.4}>
                        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 leading-relaxed mb-8">
                            An accomplished Engineering Manager with 12+ years of experience, leading CleverTap's Gaming and LiveOps team. 
                            Expertise in driving in-app experience enhancements with features like Remote Configs and A/B testing, 
                            while managing Mobile SDK development and leading innovative projects.
                        </p>
                        </SimpleAnimation>
                        <SimpleAnimation animation="fade-up" delay={0.4}>
                        <div className="flex justify-center space-x-4">
                            <a
                                href="https://linkedin.com/in/darshanpania"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                View LinkedIn
                            </a>
                            <a
                                href="https://twitter.com/i_m_Pania"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                            >
                                Follow on Twitter
                            </a>
                        </div>
                        </SimpleAnimation>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;