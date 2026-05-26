import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export default function LegalDocumentPage({ title, description, paragraphs, relatedLinks = [] }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Helmet>
        <title>{title} | Свой Гараж</title>
        {description ? <meta name="description" content={description} /> : null}
      </Helmet>

      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h1>
        {relatedLinks.length > 0 && (
          <p className="mt-3 text-sm text-gray-600">
            См. также:{' '}
            {relatedLinks.map((link, index) => (
              <React.Fragment key={link.to}>
                {index > 0 ? ' · ' : null}
                <Link to={link.to} className="text-indigo-600 hover:underline">
                  {link.label}
                </Link>
              </React.Fragment>
            ))}
          </p>
        )}
      </header>

      <article className="prose prose-sm sm:prose max-w-none text-gray-700 space-y-4">
        {paragraphs.map((text, index) => (
          <p key={index} className="leading-relaxed">
            {text}
          </p>
        ))}
      </article>

      <p className="mt-10 text-sm text-gray-500">
        <Link to="/about" className="text-indigo-600 hover:underline">
          ← О компании
        </Link>
      </p>
    </div>
  );
}
