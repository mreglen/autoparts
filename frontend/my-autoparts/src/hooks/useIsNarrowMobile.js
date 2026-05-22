import { useEffect, useState } from 'react';
import { getIsNarrowViewport, subscribeNarrowViewport } from '../constants/breakpoints';

export default function useIsNarrowMobile() {
  const [narrow, setNarrow] = useState(getIsNarrowViewport);

  useEffect(() => subscribeNarrowViewport(setNarrow), []);

  return narrow;
}
