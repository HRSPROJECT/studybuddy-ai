# StudyBuddy AI 🤖📚

An AI-powered educational platform that provides instant homework help, personalized study planning, flashcard generation, and comprehensive learning tools.

## 🌟 Features

- **AI Homework Helper**: Get instant, step-by-step solutions to any academic question
- **Image & PDF Support**: Upload images or PDFs for visual problem solving
- **Smart Flashcards**: AI-generated flashcards with spaced repetition
- **Test Generator**: Create custom tests with automatic grading
- **Study Planner**: Personalized study schedules based on your goals
- **Community**: Collaborate with other students
- **Conversation History**: All your learning sessions saved securely

## 🚀 Live Demo

Visit the live application: [StudyBuddy AI](https://yourusername.github.io/studybuddy-ai)

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI Components
- **AI Integration**: Google Genkit, Gemini 2.0 Flash
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Deployment**: GitHub Pages

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/studybuddy-ai.git
cd studybuddy-ai
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your Firebase and Google AI credentials
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:9002](http://localhost:9002) in your browser.

## 🔧 Configuration

### Firebase Setup
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Authentication and Firestore Database
3. Copy your Firebase config to `.env.local`

### Google AI Setup
1. Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add it to your `.env.local` file

## 🏗️ Build & Deploy

### Local Build
```bash
npm run build
npm run export
```

### Deploy to GitHub Pages
The project is configured for automatic deployment to GitHub Pages via GitHub Actions. Simply push to the main branch and your site will be deployed automatically.

## 📝 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run export` - Export static files
- `npm run lint` - Run ESLint
- `npm run genkit:dev` - Start Genkit development server

## 🎨 Design System

- **Primary Color**: Dark Turquoise (#30D5C8)
- **Background**: Light Cyan (#E0FFFF)
- **Accent**: Teal (#008080)
- **Typography**: PT Sans, Playfair Display, Source Code Pro

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- AI powered by [Google Gemini](https://deepmind.google/technologies/gemini/)
- UI components by [Radix UI](https://www.radix-ui.com/)
- Icons by [Lucide](https://lucide.dev/)

## 📞 Support

If you have any questions or need help, please open an issue on GitHub or contact the maintainers.

---

Made with ❤️ for students worldwide
