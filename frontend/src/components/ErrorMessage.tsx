interface Props {
  message?: string | null;
  id?: string;
}

export default function ErrorMessage({ message, id }: Props) {
  if (!message) return null;
  return (
    <div role="alert" className="error" id={id}>
      {message}
    </div>
  );
}
