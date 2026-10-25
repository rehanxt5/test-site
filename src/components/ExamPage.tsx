import { useState, useEffect, useCallback } from 'react';
import { questions } from '../data/questions';

type QuestionStatus = 'unvisited' | 'attempted' | 'marked' | 'skipped';

export default function ExamPage() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [statuses, setStatuses] = useState<QuestionStatus[]>(Array(20).fill('unvisited'));
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [submitted, setSubmitted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto fullscreen when exam starts
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        // Fullscreen request may be blocked by browser policy
      }
    };
    enterFullscreen();
  }, []);

  // Keep the toggle in sync with the actual fullscreen state (e.g. Esc exits)
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Mark the current question as skipped if it's unvisited and unanswered
  const markCurrentAsSkipped = useCallback((fromIndex: number, currentStatuses: QuestionStatus[], currentAnswers: Record<number, string | string[]>) => {
    const newStatuses = [...currentStatuses];
    if (newStatuses[fromIndex] === 'unvisited' && !currentAnswers[fromIndex]) {
      newStatuses[fromIndex] = 'skipped';
    }
    return newStatuses;
  }, []);

  const navigateToQuestion = useCallback((toIndex: number) => {
    if (toIndex === currentQuestion) return;
    if (toIndex < 0 || toIndex > 19) return;

    setStatuses(prev => {
      return markCurrentAsSkipped(currentQuestion, prev, answers);
    });

    setCurrentQuestion(toIndex);
  }, [currentQuestion, answers, markCurrentAsSkipped]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOptionSelect = (optionIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion]: String(optionIndex),
    }));
    setStatuses(prev => {
      const newStatuses = [...prev];
      if (newStatuses[currentQuestion] !== 'marked') {
        newStatuses[currentQuestion] = 'attempted';
      }
      return newStatuses;
    });
  };

  const handleDescriptiveChange = (value: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion]: value,
    }));
    if (value.trim().length > 0) {
      setStatuses(prev => {
        const newStatuses = [...prev];
        if (newStatuses[currentQuestion] !== 'marked') {
          newStatuses[currentQuestion] = 'attempted';
        }
        return newStatuses;
      });
    }
  };

  const handleNext = () => {
    if (currentQuestion < 19) {
      navigateToQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      navigateToQuestion(currentQuestion - 1);
    }
  };

  const handleMark = () => {
    setStatuses(prev => {
      const newStatuses = [...prev];
      newStatuses[currentQuestion] = 'marked';
      return newStatuses;
    });
  };

  const handleClear = () => {
    setAnswers(prev => {
      const newAnswers = { ...prev };
      delete newAnswers[currentQuestion];
      return newAnswers;
    });
    setStatuses(prev => {
      const newStatuses = [...prev];
      newStatuses[currentQuestion] = 'skipped';
      return newStatuses;
    });
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const handleQuestionClick = (index: number) => {
    navigateToQuestion(index);
  };

  const getStatusColor = (status: QuestionStatus) => {
    switch (status) {
      case 'unvisited': return 'bg-gray-300 text-gray-600';
      case 'attempted': return 'bg-green-400 text-white';
      case 'marked': return 'bg-purple-500 text-white';
      case 'skipped': return 'bg-red-400 text-white';
    }
  };

  if (submitted) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md border border-blue-100 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Exam Submitted</h2>
          <p className="text-gray-500">Your responses have been recorded.</p>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div className="w-screen h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-blue-100 px-6 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold text-gray-700">Go Lang Exam</span>
          <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">
            Question {currentQuestion + 1} / 20
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-lg font-mono font-bold ${timeLeft < 300 ? 'text-red-500' : 'text-gray-700'}`}>
            {formatTime(timeLeft)}
          </span>
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            title="Toggle fullscreen"
          >
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
          <button
            onClick={handleSubmit}
            className="bg-blue-400 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-500 transition"
          >
            Submit
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left - Question Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            {/* Question */}
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-800 leading-relaxed">
                Q{currentQuestion + 1}. {question.question}
              </h2>
            </div>

            {/* MCQ Options or Descriptive Textarea */}
            {question.type === 'mcq' ? (
              <div className="space-y-3 mb-6">
                {question.options.map((option, idx) => {
                  const selected = answers[currentQuestion] === String(idx);
                  return (
                    <label
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition ${
                        selected
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-blue-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q${currentQuestion}`}
                        checked={selected}
                        onChange={() => handleOptionSelect(idx)}
                        className="accent-blue-400"
                      />
                      <span className="text-gray-700">{option}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="mb-6">
                <textarea
                  value={(answers[currentQuestion] as string) || ''}
                  onChange={(e) => handleDescriptiveChange(e.target.value)}
                  className="w-full h-48 p-3 border border-gray-200 rounded-md resize-none focus:outline-none focus:border-blue-400 bg-white text-gray-700"
                  placeholder="Write your answer here..."
                />
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
                className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <button
                onClick={handleMark}
                className="px-4 py-2 border border-purple-300 rounded-md text-sm font-medium text-purple-600 hover:bg-purple-50 transition"
              >
                Mark
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Clear Response
              </button>
              <button
                onClick={handleNext}
                disabled={currentQuestion === 19}
                className="px-4 py-2 bg-blue-400 rounded-md text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Question Palette */}
        <div className="w-56 bg-white border-l border-blue-100 p-4 overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Questions</h3>
          <div className="grid grid-cols-4 gap-2">
            {statuses.map((status, idx) => (
              <button
                key={idx}
                onClick={() => handleQuestionClick(idx)}
                className={`w-9 h-9 rounded-md text-sm font-medium flex items-center justify-center transition ${getStatusColor(status)} ${
                  idx === currentQuestion ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-2 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-gray-300 inline-block"></span>
              <span>Not Visited</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-green-400 inline-block"></span>
              <span>Attempted</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-purple-500 inline-block"></span>
              <span>Marked</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-red-400 inline-block"></span>
              <span>Skipped</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
