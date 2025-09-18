import React, { useState } from 'react';
import { DownloadIcon, SparklesIcon } from './icons';

interface UpdateNotificationProps {
  message: string;
  isReady?: boolean;
  onRestart: () => void;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ message, isReady, onRestart }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 w-full bg-blue-600 p-3 text-white shadow-md"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0 mr-3">
            {isReady ? (
              <SparklesIcon className="h-6 w-6 text-white" title="Update Ready" />
            ) : (
              <DownloadIcon className="h-6 w-6 text-white" title="Update Status" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">{isReady ? 'アップデートの準備ができました' : 'アップデート情報'}</p>
            <p className="mt-1 text-sm">{message}</p>
          </div>
        </div>
        <div className="flex items-center">
          {isReady && (
            <button
              onClick={onRestart}
              className="mr-4 rounded-md bg-white px-3 py-1 text-sm font-semibold text-blue-600 shadow-sm hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              再起動して更新
            </button>
          )}
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 rounded-full hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;