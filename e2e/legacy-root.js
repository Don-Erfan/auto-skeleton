// createRoot shim for React 17, which only has ReactDOM.render.
import { render } from 'react-dom';

export function createRoot(container) {
  return {
    render(element) {
      render(element, container);
    },
  };
}
