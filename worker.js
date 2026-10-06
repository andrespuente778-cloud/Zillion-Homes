export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Process Form Submissions at /api/submit
    if (url.pathname === "/api/submit" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const fullName = formData.get("Full Name") || formData.get("name") || "No Name Provided";
        const email = formData.get("Email") || formData.get("email") || "No Email Provided";
        const phone = formData.get("Phone") || formData.get("phone") || "No Phone Provided";
        const message = formData.get("message") || "No message content provided.";

        // HARDCODED DESTINATION: Since Cloudflare blocks dashboard variables on static setups,
        // we put your verified routing destination email directly here.
        // CHANGE 'yourname@gmail.com' to your actual verified personal Gmail address!
        const destinationEmail = "zilowrentalshome@gmail.com"; 

        // 2. Build the Raw Email Payload required by Cloudflare's Email Binding
        const emailContent = 
          `From: inquiries@zillionhomes.rent\r\n` +
          `To: ${destinationEmail}\r\n` +
          `Reply-To: ${email}\r\n` +
          `Subject: New Website Inquiry from ${fullName}\r\n` +
          `Content-Type: text/plain; charset=utf-8\r\n\r\n` +
          `You received a new message from your website contact form:\r\n\r\n` +
          `Name: ${fullName}\r\n` +
          `Email: ${email}\r\n` +
          `Phone: ${phone}\r\n\r\n` +
          `Message:\r\n${message}\r\n`;

        // 3. Fire the email using Cloudflare's free Email Routing binding (SEB)
        await env.SEB.send({
          from: "inquiries@zillionhomes.rent",
          to: destinationEmail,
          raw: new TextEncoder().encode(emailContent)
        });

        // 4. Redirect seamlessly to your custom premium success layout
        return Response.redirect(`${url.origin}/success.html`, 302);

      } catch (error) {
        return new Response(`Submission Failed: ${error.message}`, { status: 500 });
      }
    }

    // 5. Serve all other static assets (HTML, CSS, images) via the default asset pipeline
    return env.ASSETS.fetch(request);
  }
};
