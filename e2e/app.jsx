import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AutoSkeleton } from '../dist/index.js';

const AVATAR =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#6c5ce7"/></svg>',
  );

function UserProfileCard({ user }) {
  return (
    <article className="card">
      <div className="head">
        <img className="avatar" src={user.avatar} width="64" height="64" alt="" />
        <div>
          <h2 className="name">{user.name}</h2>
          <p className="handle">
            @{user.handle} · <b>{user.followers}</b> followers
          </p>
        </div>
      </div>
      <p className="bio">{user.bio}</p>
      <div className="tags">
        {user.tags.map((tag) => (
          <span className="tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>
      <div className="actions">
        <button type="button">Follow</button>
        <input placeholder="Say hi" />
      </div>
    </article>
  );
}

const user = {
  avatar: AVATAR,
  name: 'Ada Lovelace',
  handle: 'ada',
  followers: '12.4k',
  bio: 'Mathematician and writer, chiefly known for her work on the Analytical Engine. The first to recognise that the machine had applications beyond pure calculation.',
  tags: ['math', 'engines', 'poetry'],
};

const persian = {
  avatar: AVATAR,
  name: 'عرفان',
  handle: 'erfan',
  followers: '۱۲۰',
  bio: 'یکی از کسل‌کننده‌ترین کارهای فرانت‌اند اینه که برای هر کامپوننت، بشینی دستی یه کامپوننت اسکلتون جداگانه بسازی.',
  tags: ['ری‌اکت', 'تایپ‌اسکریپت'],
};

function App() {
  const [loading, setLoading] = useState(true);
  window.__setLoading = setLoading;
  return (
    <div className="grid">
      <AutoSkeleton loading={loading} id="ltr">
        <UserProfileCard user={user} />
      </AutoSkeleton>
      <AutoSkeleton loading={loading} id="rtl" dir="rtl" animation="pulse">
        <UserProfileCard user={persian} />
      </AutoSkeleton>
      <div style={{ transform: 'scale(0.5)', transformOrigin: '0 0', height: 220 }}>
        <AutoSkeleton loading={loading} id="scaled">
          <UserProfileCard user={user} />
        </AutoSkeleton>
      </div>
      <AutoSkeleton loading={loading} id="inline">
        Plain text directly inside the wrapper, <a href="#x">with a link</a>.
      </AutoSkeleton>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
