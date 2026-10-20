import { Link } from 'react-router-dom';
import { EmptyState } from '../components/PageStates';
export function NotFoundPage() {
  return (
    <EmptyState
      action={
        <Link className="button button-primary" to="/">
          Go to dashboard
        </Link>
      }
      title="Page not found"
    >
      The address does not match a MediaHub page.
    </EmptyState>
  );
}
