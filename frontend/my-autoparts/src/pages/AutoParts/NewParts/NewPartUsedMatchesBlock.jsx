import React from 'react';
import PartArticleMatchesBlock from '../../components/PartArticleMatchesBlock/PartArticleMatchesBlock';

export default function NewPartUsedMatchesBlock({ brand, article, items, loading, error }) {
  const title = `Б/у ${brand} ${article} — дешевле?`;
  return (
    <PartArticleMatchesBlock
      title={title}
      items={items}
      loading={loading}
      error={error}
    />
  );
}
