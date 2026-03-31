import { redirect } from "next/navigation";

export default function EditItemRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/items/${params.id}`);
}
