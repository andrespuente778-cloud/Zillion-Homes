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

        // Your verified routing destination email address
        const destinationEmail = "zilowrentalshome@gmail.com"; 

        // 2. Format the readable email body text
        const plainTextMessage = 
          `You received a new message from your website contact form:\n\n` +
          `Name: ${fullName}\n` +
          `Email: ${email}\n` +
          `Phone: ${phone}\n\n` +
          `Message:\n${message}\n`;

        // 3. Fire the email using Cloudflare's expected parameters
        await env.SEB.send({
          from: "inquiries@zillionhomes.rent",
          to: destinationEmail,
          subject: `New Website Inquiry from ${fullName}`,
          text: plainTextMessage
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
