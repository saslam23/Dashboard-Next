'use server' //needed if you're creating react server components. marks server side functions that can be called from client side code.
import {z} from 'zod'; //type validation
import {sql} from '@vercel/postgres';
import {revalidatePath} from 'next/cache';
import { redirect } from '@/node_modules/next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.'
    }),
    amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0.' }),//coerce changes type to number and then validates as a number
    status: z.enum(['pending', 'paid'], {invalid_type_error: 'Please select an invoice status.'}),
    date: z.string()
})

const CreateInvoice = FormSchema.omit({id:true, date:true})
export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
  };
export async function createInvoice (prevState: State, formData: FormData){
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
      });
/*     const rawFormData = {
        customerID: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')

    } */

    if (!validatedFields.success) {
        return {
          errors: validatedFields.error.flatten().fieldErrors,
          message: 'Missing Fields. Failed to Create Invoice.',
        };
      }
     
      const { customerId, amount, status } = validatedFields.data;
      const amountInCents = amount * 100;
      const date = new Date().toISOString().split('T')[0];


    try {
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
 
    } catch (error) {
        console.log(error);
        return { message: 'Database Error: Failed to Create Invoice'}
    }
   
    revalidatePath('/dashboard/invoices');//revalidate and redirect. clears cache and requeries the table
    redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({id:true, date:true})
export async function updateInvoice(id: string, formData:FormData){
const {customerId, amount, status} = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status')

});
const amountInCents = amount * 100;
try {
    await sql`
update invoices
set customer_id=${customerId}, amount=${amountInCents}, status=${status}
where id=${id}`

 
} catch (error) {
    return{
        message: 'Database Error: Failed to Update Invoice'
    }
}

revalidatePath('/dashboard/invoices');
redirect('/dashboard/invoices');
}

export async function deleteInvoice(id:string){
    //throw new Error("failed to delete Invoice");
    try {
        await sql `delete from invoices where id = ${id}`
    } catch (error) {
        return {
            message: 'Database Error: Failed to delete invoice.'
        }
    }

    revalidatePath('dashboard/invoices');
}


 
export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
  ) {
    try {
      await signIn('credentials', formData);
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return 'Invalid credentials.';
          default:
            return 'Something went wrong.';
        }
      }
      throw error;
    }
  }