import InvoicePrint from "@/app/invoice-print";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <InvoicePrint kind="purchase" id={id}/>; }
