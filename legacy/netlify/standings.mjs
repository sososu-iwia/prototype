export default async () => {

    try {

        const apiKey =
            process.env.API_FOOTBALL_KEY;


        if (!apiKey) {

            return new Response(
                JSON.stringify({
                    error: "API key missing"
                }),
                {
                    status: 500,
                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );

        }


        const response =
            await fetch(
                "https://v3.football.api-sports.io/standings?league=389&season=2026",
                {
                    headers: {
                        "x-apisports-key":
                            apiKey
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            return new Response(
                JSON.stringify(data),
                {
                    status: response.status,

                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );

        }


        return new Response(
            JSON.stringify(data),
            {
                status: 200,

                headers: {
                    "Content-Type":
                        "application/json",

                    "Cache-Control":
                        "public, max-age=3600"
                }
            }
        );


    } catch (error) {

        return new Response(
            JSON.stringify({
                error:
                    "Failed to load standings"
            }),
            {
                status: 500,

                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );

    }

};
